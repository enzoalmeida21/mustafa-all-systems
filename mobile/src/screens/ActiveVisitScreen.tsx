import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { visitService } from '../services/visitService';
import { photoService } from '../services/photoService';
import { industryService } from '../services/industryService';
import { offlineSyncService } from '../services/offlineSyncService';
import { useVisitFlow } from '../features/visits';
import { colors, theme } from '../styles/theme';
import Button from '../components/ui/Button';
import { requestForegroundPermissions, getCurrentPosition } from '../utils/locationHelper';
import { savePendingPhotos, getPendingPhotos, clearPendingPhotos, PendingPhoto } from '../utils/sessionStorage';

interface Visit {
  id: string;
  store?: {
    id: string;
    name: string;
    address: string;
  };
  checkInAt: string;
  photos: Array<{
    id: string;
    url: string;
    type: 'FACADE_CHECKIN' | 'FACADE_CHECKOUT' | 'OTHER';
    industryId?: string;
    selectedIndustryId?: string;
  }>;
}

type VisitPhoto = {
  id?: string;
  uri?: string;
  url?: string;
  type: 'FACADE_CHECKIN' | 'FACADE_CHECKOUT' | 'OTHER';
  industryId?: string;
};

type Industry = {
  id: string;
  name: string;
  code: string;
  description?: string;
};

type ActiveVisitNavigation = NavigationProp<Record<string, object | undefined>>;

export default function ActiveVisitScreen({ route }: any) {
  const navigation = useNavigation<ActiveVisitNavigation>();
  const { visit: initialVisit } = route.params || {};
  const {
    visit: localVisit,
    isActiveVisit,
    setWorking,
    pendingPhotosCount,
    pendingSurveysCount,
    clearVisit,
    syncFromServerCurrentVisit,
  } = useVisitFlow();
  const [visit, setVisit] = useState<Visit | null>(initialVisit);
  const [loadingVisit, setLoadingVisit] = useState(!initialVisit);
  const [visitLoadError, setVisitLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [activeIndustryId, setActiveIndustryId] = useState<string | null>(null);
  const [expandedIndustries, setExpandedIndustries] = useState<Set<string>>(new Set());
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [needsSupervisorAssignment, setNeedsSupervisorAssignment] = useState<boolean | null>(null);
  const [industriesLoaded, setIndustriesLoaded] = useState(false);
  const [onboardingSelectedIds, setOnboardingSelectedIds] = useState<Set<string>>(new Set());
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);

  useEffect(() => {
    loadCurrentVisit();
    setWorking().catch(() => {});
  }, []);

  useEffect(() => {
    if (visit?.id) {
      restorePendingPhotos();
    }
  }, [visit?.id]);

  useEffect(() => {
    if (visit?.id && visit?.store?.id) {
      loadIndustries();
    }
  }, [visit?.id, visit?.store?.id]);

  async function loadIndustries() {
    if (!visit?.id || !visit?.store?.id) return;

    setIndustriesLoaded(false);
    try {
      const data = await industryService.getVisitIndustries(visit.id);
      setIndustries(data.industries);
      setNeedsOnboarding(data.needsOnboarding);
      setNeedsSupervisorAssignment(!!data.needsSupervisorAssignment);
      if (!data.needsOnboarding && !data.needsSupervisorAssignment && data.industries.length > 0) {
        setExpandedIndustries(new Set(data.industries.map((i: Industry) => i.id)));
      } else {
        setOnboardingSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Error loading industries:', error);
      setNeedsSupervisorAssignment(false);
      setNeedsOnboarding(false);
      setIndustries([]);
    } finally {
      setIndustriesLoaded(true);
    }
  }

  function toggleOnboardingIndustry(id: string) {
    setOnboardingSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmOnboarding() {
    if (!visit?.store?.id || onboardingSelectedIds.size === 0) return;
    setOnboardingSubmitting(true);
    try {
      const res = await industryService.setMyStoreIndustries(
        visit.store.id,
        Array.from(onboardingSelectedIds),
      );
      setNeedsOnboarding(false);
      setIndustries(res.industries);
      setExpandedIndustries(new Set(res.industries.map((i: Industry) => i.id)));
    } catch (error) {
      console.error('Error saving store industries:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setOnboardingSubmitting(false);
    }
  }

  async function restorePendingPhotos() {
    if (!visit?.id) return;

    try {
      const pendingPhotos = await getPendingPhotos(visit.id);
      if (pendingPhotos.length > 0) {
        const restoredPhotos: VisitPhoto[] = pendingPhotos.map(photo => ({
          uri: photo.uri,
          type: photo.type,
          industryId: photo.industryId,
        }));
        setPhotos((prev) => {
          const existingUris = new Set(prev.map(p => p.uri || p.url));
          const newPhotos = restoredPhotos.filter(p => p.uri && !existingUris.has(p.uri));
          return [...prev, ...newPhotos];
        });
      }
    } catch (error) {
      console.error('[ActiveVisitScreen] Erro ao restaurar fotos pendentes:', error);
    }
  }

  function buildVisitFromLocal(lv: {
    visitId: string;
    storeId: string;
    storeName: string;
    storeAddress: string;
    checkinAt: string | null;
  }): Visit {
    return {
      id: lv.visitId,
      store: {
        id: lv.storeId,
        name: lv.storeName,
        address: lv.storeAddress,
      },
      checkInAt: lv.checkinAt || new Date().toISOString(),
      photos: [],
    };
  }

  async function loadCurrentVisit() {
    try {
      setLoadingVisit(true);
      setVisitLoadError(false);
      const response = await visitService.getCurrentVisit();
      if (response.visit) {
        await syncFromServerCurrentVisit(response.visit);
        setVisit(response.visit);
        const workPhotos = (response.visit.photos || [])
          .filter((photo: Visit['photos'][number]) =>
            photo.type !== 'FACADE_CHECKIN' && photo.type !== 'FACADE_CHECKOUT'
          )
          .map((photo: Visit['photos'][number]) => ({
            id: photo.id,
            url: photo.url,
            type: photo.type ?? 'OTHER',
            industryId: photo.selectedIndustryId || photo.industryId,
          }));
        setPhotos(workPhotos);
      } else {
        await clearVisit();
        setVisit(null);
        navigation.navigate('Stores');
      }
    } catch (error) {
      console.error('Error loading visit:', error);
      if (initialVisit) {
        setVisit(initialVisit);
        setVisitLoadError(false);
      } else if (localVisit && isActiveVisit) {
        setVisit(buildVisitFromLocal(localVisit));
        setVisitLoadError(false);
      } else {
        setVisitLoadError(true);
      }
    } finally {
      setLoadingVisit(false);
    }
  }

  const savePendingPhotosToStorage = useCallback(async (visitId: string, photosToSave: VisitPhoto[]) => {
    try {
      const pendingPhotos: PendingPhoto[] = photosToSave
        .filter(p => p.uri && !p.url)
        .map(p => ({
          uri: p.uri!,
          type: p.type,
          visitId,
          industryId: p.industryId,
          timestamp: Date.now(),
        }));

      if (pendingPhotos.length > 0) {
        await savePendingPhotos(visitId, pendingPhotos);
      }
    } catch (error) {
      console.error('[ActiveVisitScreen] Erro ao salvar fotos pendentes:', error);
    }
  }, []);

  // ---- Novo fluxo: primeiro indústria, depois fotos ----

  async function pickImagesForIndustry(industryId: string) {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'É necessário permitir o acesso à galeria');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 20,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos: VisitPhoto[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'OTHER' as const,
          industryId,
        }));

        setPhotos((prev) => {
          const updated = [...prev, ...newPhotos];
          if (visit?.id) {
            savePendingPhotosToStorage(visit.id, updated);
          }
          return updated;
        });

        // Garantir que a indústria fique expandida
        setExpandedIndustries(prev => new Set(prev).add(industryId));
      }
    } catch (error) {
      console.error('Erro ao selecionar imagens:', error);
      Alert.alert('Erro', 'Não foi possível selecionar as imagens');
    }
  }

  async function takePhotoForIndustry(industryId: string) {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'É necessário permitir o acesso à câmera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhoto: VisitPhoto = {
          uri: result.assets[0].uri,
          type: 'OTHER',
          industryId,
        };

        setPhotos((prev) => {
          const updated = [...prev, newPhoto];
          if (visit?.id) {
            savePendingPhotosToStorage(visit.id, updated);
          }
          return updated;
        });

        setExpandedIndustries(prev => new Set(prev).add(industryId));
      }
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      Alert.alert('Erro', 'Não foi possível capturar a foto');
    }
  }

  // Para lojas sem indústrias configuradas
  async function pickImagesNoIndustry() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'É necessário permitir o acesso à galeria');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 20,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos: VisitPhoto[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'OTHER' as const,
        }));

        setPhotos((prev) => {
          const updated = [...prev, ...newPhotos];
          if (visit?.id) savePendingPhotosToStorage(visit.id, updated);
          return updated;
        });
      }
    } catch (error) {
      console.error('Erro ao selecionar imagens:', error);
      Alert.alert('Erro', 'Não foi possível selecionar as imagens');
    }
  }

  async function takePhotoNoIndustry() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'É necessário permitir o acesso à câmera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhoto: VisitPhoto = {
          uri: result.assets[0].uri,
          type: 'OTHER',
        };

        setPhotos((prev) => {
          const updated = [...prev, newPhoto];
          if (visit?.id) savePendingPhotosToStorage(visit.id, updated);
          return updated;
        });
      }
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      Alert.alert('Erro', 'Não foi possível capturar a foto');
    }
  }

  function removePhoto(index: number) {
    Alert.alert(
      'Remover foto',
      'Deseja remover esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            setPhotos((prev) => {
              const updated = prev.filter((_, i) => i !== index);
              if (visit?.id) savePendingPhotosToStorage(visit.id, updated);
              return updated;
            });
          },
        },
      ]
    );
  }

  function toggleIndustry(industryId: string) {
    setExpandedIndustries(prev => {
      const next = new Set(prev);
      if (next.has(industryId)) {
        next.delete(industryId);
      } else {
        next.add(industryId);
      }
      return next;
    });
  }

  function getIndustryColor(code: string): string {
    const colorMap: Record<string, string> = {
      'A': '#FF6B6B', 'B': '#4ECDC4', 'C': '#45B7D1', 'D': '#96CEB4',
      'E': '#FFEAA7', 'F': '#DDA0DD', 'G': '#98D8C8', 'H': '#F7DC6F',
      'I': '#BB8FCE', 'J': '#85C1E9', 'K': '#F8B500', 'L': '#00CED1',
      'M': '#FF69B4', 'N': '#32CD32', 'O': '#FFD700', 'P': '#FF4500',
    };
    const firstChar = (code || 'A').charAt(0).toUpperCase();
    return colorMap[firstChar] || '#6C63FF';
  }

  function getPhotosForIndustry(industryId: string): VisitPhoto[] {
    return photos.filter(p => p.industryId === industryId);
  }

  function getPhotosWithoutIndustry(): VisitPhoto[] {
    return photos.filter(p => !p.industryId);
  }

  function getGlobalPhotoIndex(industryId: string | null, localIndex: number): number {
    let count = 0;
    for (const p of photos) {
      if (industryId ? p.industryId === industryId : !p.industryId) {
        if (localIndex === 0) return count;
        localIndex--;
      }
      count++;
    }
    return -1;
  }

  async function uploadPhotos() {
    if (!visit || photos.length === 0) {
      Alert.alert('Erro', 'Não há fotos para enviar');
      return;
    }

    setUploading(true);
    try {
      const permission = await requestForegroundPermissions();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'É necessário permitir o acesso à localização para enviar fotos.',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => setUploading(false) },
            { text: 'Tentar novamente', onPress: uploadPhotos },
          ]
        );
        return;
      }

      const location = await getCurrentPosition();

      const photosToUpload = photos.filter((photo) => {
        const hasUri = photo.uri && photo.uri.startsWith('file://');
        const alreadyUploaded = photo.url && !photo.uri;
        return hasUri && !alreadyUploaded;
      });

      if (photosToUpload.length === 0) {
        Alert.alert('Aviso', 'Não há fotos novas para enviar');
        setUploading(false);
        return;
      }

      const uploadResults: { photo: VisitPhoto; url: string; success: boolean }[] = [];

      for (const photo of photosToUpload) {
        try {
          const { presignedUrl, url } = await photoService.getPresignedUrl({
            visitId: visit.id,
            type: 'OTHER',
            contentType: 'image/jpeg',
            extension: 'jpg',
          });

          if (!presignedUrl || !photo.uri) {
            throw new Error('Presigned URL ou photoUri não disponível');
          }

          const uploadSuccess = await photoService.uploadToFirebase(presignedUrl, photo.uri, 'image/jpeg');
          if (!uploadSuccess) throw new Error('Upload retornou false');

          uploadResults.push({ photo, url, success: true });
        } catch (error: any) {
          console.error('❌ [ActiveVisit] Erro no upload:', error?.message);
          uploadResults.push({ photo, url: '', success: false });
        }
      }

      const successResults = uploadResults.filter(r => r.success);
      const failedCount = uploadResults.filter(r => !r.success).length;

      if (successResults.length === 0) {
        Alert.alert('Erro', 'Nenhuma foto foi enviada com sucesso');
        setUploading(false);
        return;
      }

      try {
        await visitService.uploadPhotos({
          visitId: visit.id,
          photos: successResults.map(r => ({
            url: r.url,
            type: 'OTHER' as const,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            industryId: r.photo.industryId,
          })),
        });

        await clearPendingPhotos(visit.id);

        const uriToUrl = new Map<string, string>();
        successResults.forEach(r => {
          if (r.photo.uri) uriToUrl.set(r.photo.uri, r.url);
        });

        setPhotos((prev) =>
          prev.map((p) => {
            const newUrl = p.uri ? uriToUrl.get(p.uri) : undefined;
            if (newUrl) {
              return { ...p, url: newUrl, uri: undefined };
            }
            return p;
          })
        );
      } catch (error: any) {
        console.error('❌ [ActiveVisit] Erro ao registrar fotos no backend:', error);
        Alert.alert('Aviso', `${successResults.length} foto(s) enviadas, mas houve erro ao registrar`);
        setUploading(false);
        return;
      }

      if (failedCount > 0) {
        Alert.alert('Sucesso parcial', `${successResults.length} foto(s) enviadas. ${failedCount} falharam.`);
      } else {
        Alert.alert('Sucesso', `${successResults.length} foto(s) enviadas com sucesso!`);
      }
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao enviar fotos');
    } finally {
      setUploading(false);
    }
  }

  function navigateToPriceResearch() {
    navigation.navigate('PriceResearch', { visit });
  }

  function navigateToCheckout() {
    navigation.navigate('Checkout', { visit });
  }

  // ---- Contadores ----
  const totalPending = photos.filter(p => p.uri && !p.url).length;
  const totalUploaded = photos.filter(p => p.url).length;

  // ---- Render helpers ----

  function renderPhotoGrid(industryPhotos: VisitPhoto[], industryId: string | null) {
    if (industryPhotos.length === 0) {
      return (
        <View style={styles.emptyPhotos}>
          <Text style={styles.emptyPhotosText}>Nenhuma foto adicionada</Text>
        </View>
      );
    }

    return (
      <View style={styles.photoGrid}>
        {industryPhotos.map((photo, localIdx) => {
          const sourceUri = photo.uri || photo.url;
          if (!sourceUri) return null;
          const isPending = !!photo.uri && !photo.url;
          const globalIdx = getGlobalPhotoIndex(industryId, localIdx);

          return (
            <TouchableOpacity
              key={`photo-${industryId ?? 'none'}-${localIdx}-${photo.id ?? ''}`}
              style={styles.photoThumbnailContainer}
              onPress={() => setSelectedPhotoIndex(globalIdx)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: sourceUri }} style={styles.photoThumbnail as any} />
              {isPending ? (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pendente</Text>
                </View>
              ) : (
                <View style={styles.uploadedBadge}>
                  <Text style={styles.uploadedBadgeText}>✓</Text>
                </View>
              )}
              {isPending && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    removePhoto(globalIdx);
                  }}
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderIndustrySection(industry: Industry) {
    const industryPhotos = getPhotosForIndustry(industry.id);
    const isExpanded = expandedIndustries.has(industry.id);
    const pendingCount = industryPhotos.filter(p => p.uri && !p.url).length;
    const uploadedCount = industryPhotos.filter(p => p.url).length;

    return (
      <View key={industry.id} style={styles.industrySection}>
        <TouchableOpacity
          style={styles.industryHeader}
          onPress={() => toggleIndustry(industry.id)}
          activeOpacity={0.7}
        >
          <View style={styles.industryHeaderLeft}>
            <View style={[styles.industryBadge, { backgroundColor: getIndustryColor(industry.code) }]}>
              <Text style={styles.industryBadgeText}>{industry.code}</Text>
            </View>
            <View style={styles.industryHeaderInfo}>
              <Text style={styles.industryName}>{industry.name}</Text>
              <Text style={styles.industryStats}>
                {uploadedCount} enviada{uploadedCount !== 1 ? 's' : ''}
                {pendingCount > 0 ? ` · ${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}` : ''}
              </Text>
            </View>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.industryContent}>
            {renderPhotoGrid(industryPhotos, industry.id)}
            <View style={styles.industryActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.galleryButton]}
                onPress={() => pickImagesForIndustry(industry.id)}
              >
                <Text style={styles.actionButtonText}>📁 Galeria</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cameraButton]}
                onPress={() => takePhotoForIndustry(industry.id)}
              >
                <Text style={styles.actionButtonText}>📷 Câmera</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ---- Screens de loading/vazio ----

  if (loadingVisit) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={[styles.text, { marginTop: 16 }]}>Carregando visita...</Text>
      </View>
    );
  }

  if (!visit) {
    if (visitLoadError) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Text style={[styles.title, { textAlign: 'center' }]}>Não foi possível sincronizar</Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 12 }]}>
            Verifique a conexão e tente novamente. Seu progresso local foi preservado quando disponível.
          </Text>
          <TouchableOpacity
            style={[styles.navButton, styles.primaryButton, { marginTop: 24, alignSelf: 'stretch' }]}
            onPress={() => loadCurrentVisit()}
          >
            <Text style={styles.navButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, { marginTop: 12, backgroundColor: colors.dark.cardElevated }]}
            onPress={() => navigation.navigate('Stores')}
          >
            <Text style={styles.navButtonText}>Ir para lojas</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={[styles.text, { marginTop: 16 }]}>Redirecionando para iniciar nova visita...</Text>
      </View>
    );
  }

  if (!industriesLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={[styles.text, { marginTop: 16 }]}>Carregando indústrias da visita...</Text>
      </View>
    );
  }

  // ---- Aguardando supervisor definir indústrias na rota (web) ----

  if (needsSupervisorAssignment === true) {
    return (
      <View style={[styles.container, { padding: 24, justifyContent: 'center' }]}>
        <Text style={styles.title}>Indústrias não configuradas</Text>
        <Text style={[styles.subtitle, { marginTop: 12 }]}>
          Seu supervisor precisa marcar as indústrias desta loja em Configurar rotas (painel web) antes de você enviar fotos por indústria.
        </Text>
        <TouchableOpacity
          style={[styles.navButton, styles.primaryButton, { marginTop: 24 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.navButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Onboarding legado (API não deve mais retornar needsOnboarding true) ----

  if (needsOnboarding === true && industries.length > 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Indústrias nesta loja</Text>
          <Text style={[styles.subtitle, { marginTop: 8 }]}>
            Selecione as indústrias que você atende nesta loja (obrigatório no primeiro check-in).
          </Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {industries.map((industry) => {
            const isSelected = onboardingSelectedIds.has(industry.id);
            return (
              <TouchableOpacity
                key={industry.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  marginBottom: 8,
                  backgroundColor: isSelected ? colors.primary[100] : colors.dark.card,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary[600] : colors.dark.border,
                }}
                onPress={() => toggleOnboardingIndustry(industry.id)}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary[600] : colors.dark.border,
                  backgroundColor: isSelected ? colors.primary[600] : 'transparent',
                  marginRight: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  {isSelected && <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.industryName, { marginBottom: 2 }]} numberOfLines={2}>{industry.name}</Text>
                  <Text style={styles.textTertiary}>Cód. {industry.code}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.dark.border }}>
          <Button
            variant="primary"
            size="lg"
            onPress={confirmOnboarding}
            disabled={onboardingSelectedIds.size === 0 || onboardingSubmitting}
            isLoading={onboardingSubmitting}
            style={{ width: '100%' }}
          >
            Confirmar ({onboardingSelectedIds.size} selecionada{onboardingSelectedIds.size !== 1 ? 's' : ''})
          </Button>
          <Text style={[styles.textTertiary, { textAlign: 'center', marginTop: 8, fontSize: 12 }]}>
            Selecione pelo menos uma indústria para continuar.
          </Text>
        </View>
      </View>
    );
  }

  // ---- Render principal ----

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Visita em Andamento</Text>
        <Text style={styles.storeName}>{visit.store?.name ?? 'Loja'}</Text>
        <Text style={styles.address}>{visit.store?.address ?? 'Endereço não disponível'}</Text>
        <Text style={styles.time}>
          Check-in: {new Date(visit.checkInAt).toLocaleTimeString()}
        </Text>
      </View>

      {/* Seção de Fotos */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fotos do Trabalho</Text>
          <View style={styles.photoCounter}>
            <Text style={styles.photoCounterText}>
              {totalPending > 0 ? `${totalPending} pendentes · ` : ''}{totalUploaded + totalPending} total
            </Text>
          </View>
        </View>

        {industries.length > 0 ? (
          // Com indústrias: mostrar seções agrupadas
          <View>
            {industries.map(industry => renderIndustrySection(industry))}
          </View>
        ) : (
          // Sem indústrias: fluxo simples
          <View>
            {renderPhotoGrid(getPhotosWithoutIndustry(), null)}
            <View style={styles.industryActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.galleryButton]}
                onPress={pickImagesNoIndustry}
              >
                <Text style={styles.actionButtonText}>📁 Galeria</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cameraButton]}
                onPress={takePhotoNoIndustry}
              >
                <Text style={styles.actionButtonText}>📷 Câmera</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Botão Enviar */}
        {totalPending > 0 && (
          <TouchableOpacity
            style={[styles.sendButton]}
            onPress={uploadPhotos}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>
                Enviar {totalPending} foto{totalPending !== 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Pesquisa de Preços */}
      <View style={styles.section}>
        <TouchableOpacity style={[styles.navButton, styles.primaryButton]} onPress={navigateToPriceResearch}>
          <Text style={styles.navButtonText}>Pesquisa de Preços</Text>
        </TouchableOpacity>
      </View>

      {/* Sincronização */}
      {(pendingPhotosCount > 0 || pendingSurveysCount > 0) && (
        <View style={styles.section}>
          <View style={styles.syncInfoContainer}>
            <Text style={styles.syncInfoText}>
              {pendingPhotosCount} foto(s) e {pendingSurveysCount} pesquisa(s) pendentes de sync
            </Text>
            <TouchableOpacity
              style={[styles.navButton, styles.syncButton]}
              onPress={async () => {
                setSyncing(true);
                try {
                  await offlineSyncService.syncAll();
                  Alert.alert('Sincronizado', 'Dados sincronizados com sucesso!');
                } catch {
                  Alert.alert('Erro', 'Falha ao sincronizar. Tente novamente mais tarde.');
                } finally {
                  setSyncing(false);
                }
              }}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.navButtonText}>Sincronizar Agora</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Checkout */}
      <View style={styles.section}>
        <TouchableOpacity style={[styles.navButton, styles.checkoutButton]} onPress={navigateToCheckout}>
          <Text style={styles.navButtonText}>Fazer Checkout</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Preview Fullscreen */}
      {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedPhotoIndex(null)}>
          <View style={styles.fullscreenModal}>
            <TouchableOpacity
              style={styles.fullscreenBackdrop}
              activeOpacity={1}
              onPress={() => setSelectedPhotoIndex(null)}
            >
              <View style={styles.fullscreenContent}>
                <TouchableOpacity
                  style={styles.fullscreenClose}
                  onPress={() => setSelectedPhotoIndex(null)}
                >
                  <Text style={styles.fullscreenCloseText}>✕</Text>
                </TouchableOpacity>
                <Image
                  source={{ uri: photos[selectedPhotoIndex].uri || photos[selectedPhotoIndex].url }}
                  style={styles.fullscreenImage as any}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  header: {
    backgroundColor: colors.dark.card,
    padding: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.text.primary,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: colors.text.primary,
  },
  address: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 10,
  },
  time: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  section: {
    backgroundColor: colors.dark.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: theme.borderRadius.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  photoCounter: {
    backgroundColor: colors.dark.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  photoCounterText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
    color: colors.text.secondary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  textTertiary: {
    fontSize: 12,
    color: colors.text.tertiary,
  },

  // ---- Indústria section ----
  industrySection: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  industryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: colors.dark.cardElevated,
  },
  industryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  industryBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  industryBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  industryHeaderInfo: {
    flex: 1,
  },
  industryName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  industryStats: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginLeft: 8,
  },
  industryContent: {
    padding: 12,
    backgroundColor: colors.dark.background,
  },
  industryActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    backgroundColor: colors.primary[600],
  },
  cameraButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyPhotos: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyPhotosText: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontStyle: 'italic',
  },

  // ---- Photo grid ----
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  photoThumbnailContainer: {
    width: '31%',
    aspectRatio: 1,
    position: 'relative',
    marginBottom: 4,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    backgroundColor: colors.dark.cardElevated,
  },
  pendingBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: colors.warning + 'CC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  pendingBadgeText: {
    fontSize: 10,
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  uploadedBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: colors.success + 'CC',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedBadgeText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error + 'CC',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: 'bold',
    lineHeight: 18,
  },

  // ---- Enviar / Nav buttons ----
  sendButton: {
    backgroundColor: colors.accent[500],
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  navButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
  },
  syncButton: {
    backgroundColor: colors.primary[600],
    marginTop: 8,
  },
  checkoutButton: {
    backgroundColor: colors.error,
  },
  syncInfoContainer: {
    alignItems: 'center',
  },
  syncInfoText: {
    fontSize: 14,
    color: colors.warning || '#f59e0b',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },

  // ---- Fullscreen preview ----
  fullscreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fullscreenBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1001,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseText: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
