import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { visitService } from '../services/visitService';
import { industryService } from '../services/industryService';
import { photoService } from '../services/photoService';
import { useVisitFlow } from '../features/visits';
import { colors, theme } from '../styles/theme';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { requestForegroundPermissions, getCurrentPosition, LocationObject } from '../utils/locationHelper';

interface Visit {
  id: string;
  store: {
    id: string;
    name: string;
    address: string;
  };
  checkInAt: string;
}


type RootStackParamList = {
  Home: undefined;
};

export default function CheckoutScreen({ route }: any) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { visit: initialVisit } = route.params || {};
  const { clearVisit, pendingPhotosCount, pendingSurveysCount } = useVisitFlow();
  const [visit, setVisit] = useState<Visit | null>(initialVisit);
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [justifyModalOpen, setJustifyModalOpen] = useState(false);
  const [justifyPendingIndustries, setJustifyPendingIndustries] = useState<Array<{ id: string; name: string; abbreviation?: string | null; code?: string }>>([]);
  const [justifyReasonOptions, setJustifyReasonOptions] = useState<Array<{ code: string; label: string }>>([]);
  const [justifySelections, setJustifySelections] = useState<Record<string, { reason?: string; note?: string }>>({});
  const [pendingCheckoutPayload, setPendingCheckoutPayload] = useState<{
    visitId: string;
    latitude: number;
    longitude: number;
    photoUrl: string;
  } | null>(null);

  useEffect(() => {
    requestLocationPermission();
    requestCameraPermission();
    if (visit?.checkInAt) {
      setCheckInTime(new Date(visit.checkInAt));
    }
  }, []);

  async function requestLocationPermission() {
    try {
      setLocationLoading(true);
      const permission = await requestForegroundPermissions();
      
      if (permission.status === 'granted') {
        const loc = await getCurrentPosition();
        setLocation(loc);
        console.log('📍 [Checkout] Localização obtida:', loc.coords);
      } else {
        Alert.alert(
          'Permissão necessária',
          'É necessário permitir o acesso à localização para fazer checkout.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Tentar novamente', onPress: requestLocationPermission },
          ]
        );
      }
    } catch (error: any) {
      console.error('❌ [Checkout] Erro ao solicitar permissão de localização:', error);
      Alert.alert('Erro', error?.message || 'Não foi possível solicitar permissão de localização');
    } finally {
      setLocationLoading(false);
    }
  }

  // Função para atualizar localização (pode ser chamada a qualquer momento)
  async function updateLocation(): Promise<LocationObject | null> {
    try {
      setLocationLoading(true);
      console.log('📍 [Checkout] Atualizando localização...');
      
      // Verificar permissão primeiro
      const permission = await requestForegroundPermissions();
      
      if (permission.status !== 'granted') {
        console.warn('⚠️ [Checkout] Permissão de localização não concedida');
        setLocationLoading(false);
        return null;
      }

      // Obter localização atualizada
      const loc = await getCurrentPosition({
        accuracy: 6, // Alta precisão
        maximumAge: 10000, // Aceitar localização com até 10 segundos
        timeout: 15000, // Timeout de 15 segundos
      });
      
      setLocation(loc);
      console.log('✅ [Checkout] Localização atualizada:', loc.coords);
      setLocationLoading(false);
      return loc;
    } catch (error: any) {
      console.error('❌ [Checkout] Erro ao atualizar localização:', error);
      setLocationLoading(false);
      return null;
    }
  }

  async function requestCameraPermission() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setCameraPermission(status === 'granted');
    } catch (error) {
      console.error('Erro ao solicitar permissão de câmera:', error);
      setCameraPermission(false);
    }
  }

  async function takePhoto() {
    try {
      if (cameraPermission === false) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        setCameraPermission(status === 'granted');
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'É necessário permitir o acesso à câmera');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setShowPreview(true);
        
        // Atualizar localização após tirar a foto
        console.log('📸 [Checkout] Foto capturada, atualizando localização...');
        await updateLocation();
      }
    } catch (error) {
      console.error('❌ [Checkout] Erro ao capturar foto:', error);
      Alert.alert('Erro', 'Não foi possível capturar a foto');
    }
  }

  // Função auxiliar para prosseguir com o checkout após validações
  async function completeCheckout(payload: { visitId: string; latitude: number; longitude: number; photoUrl: string }) {
    const result = await visitService.checkOut(payload);

    // Limpar estado local -- o backend é a fonte de verdade para checkout
    try {
      await clearVisit();
    } catch {}

    const hoursWorked = result.visit?.hoursWorked || '0.00';

    const hasPending = pendingPhotosCount > 0 || pendingSurveysCount > 0;
    const pendingMsg = hasPending
      ? `\n\n${pendingPhotosCount} foto(s) e ${pendingSurveysCount} pesquisa(s) serão sincronizadas quando houver internet.`
      : '';

    Alert.alert(
      'Sucesso',
      `Checkout realizado com sucesso!\n\nHoras trabalhadas: ${hoursWorked}h${pendingMsg}`,
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('Home');
          },
        },
      ]
    );
  }

  async function proceedWithCheckout(currentLocation: LocationObject) {
    setLoading(true);
    try {
      let checkoutPhotoUrl = '';
      console.log('📸 [Checkout] Iniciando processo de checkout...');
      console.log('📸 [Checkout] Visit ID:', visit!.id);
      console.log('📸 [Checkout] Location:', currentLocation.coords);
      console.log('📸 [Checkout] Photo URI:', photoUri);

      // 1. Obter presigned URL para upload da foto
      console.log('📸 [Checkout] Obtendo presigned URL...');
      const { presignedUrl, url } = await photoService.getPresignedUrl({
        visitId: visit!.id,
        type: 'FACADE_CHECKOUT',
        contentType: 'image/jpeg',
        extension: 'jpg',
      });

      console.log('📸 [Checkout] Presigned URL obtida:', presignedUrl ? 'Sim' : 'Não');
      console.log('📸 [Checkout] URL final:', url);
      checkoutPhotoUrl = url;

      // 2. Upload da foto para Firebase Storage
      if (photoUri && presignedUrl) {
        try {
          console.log('📸 [Checkout] Fazendo upload da foto...');
          const uploadSuccess = await photoService.uploadToFirebase(presignedUrl, photoUri, 'image/jpeg');
          
          if (!uploadSuccess) {
            console.warn('⚠️ [Checkout] Upload da foto falhou, mas continuando com checkout...');
          } else {
            console.log('✅ [Checkout] Upload da foto concluído com sucesso');
          }
        } catch (uploadError: any) {
          console.error('❌ [Checkout] Erro no upload da foto:', uploadError);
          console.error('❌ [Checkout] Mensagem:', uploadError?.message);
          console.warn('⚠️ [Checkout] Continuando checkout sem confirmação de upload...');
        }
      } else {
        console.warn('⚠️ [Checkout] Presigned URL ou photoUri não disponível');
      }

      // 3. Fazer checkout
      console.log('📸 [Checkout] Enviando requisição de checkout...');
      const payload = {
        visitId: visit!.id,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        photoUrl: checkoutPhotoUrl,
      };

      await completeCheckout(payload);
    } catch (error: any) {
      console.error('[Checkout] Erro no checkout:', error);
      const data = error?.response?.data;
      if (data?.code === 'MISSING_INDUSTRY_JUSTIFICATION' && Array.isArray(data?.pendingIndustries)) {
        // Guardar payload exato para finalizar sem reupload após justificar
        const safePhotoUrl = (() => {
          try {
            const parsed = JSON.parse(error?.config?.data || '{}');
            return typeof parsed.photoUrl === 'string' ? parsed.photoUrl : '';
          } catch {
            return '';
          }
        })();
        setPendingCheckoutPayload({
          visitId: visit!.id,
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          photoUrl: safePhotoUrl,
        });

        setJustifyPendingIndustries(data.pendingIndustries);
        setJustifyReasonOptions(data.reasonOptions || []);
        setJustifySelections({});
        setJustifyModalOpen(true);
        return;
      }
      Alert.alert('Erro', data?.message || 'Não foi possível fazer checkout');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    if (!visit) {
      Alert.alert('Erro', 'Visita não encontrada');
      return;
    }

    if (!photoUri) {
      Alert.alert('Erro', 'Tire uma foto da fachada primeiro');
      return;
    }

    // Tentar obter localização se não estiver disponível
    let currentLocation = location;
    if (!currentLocation) {
      console.log('📍 [Checkout] Localização não disponível, tentando obter...');
      const updatedLocation = await updateLocation();
      if (!updatedLocation) {
        Alert.alert(
          'Localização necessária',
          'Não foi possível obter a localização. Por favor, verifique as permissões e tente novamente.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Tentar novamente', onPress: async () => {
              const retryLocation = await updateLocation();
              if (retryLocation) {
                handleCheckout();
              }
            }},
          ]
        );
        return;
      }
      currentLocation = updatedLocation;
    }

    if (!currentLocation) {
      Alert.alert('Erro', 'Não foi possível obter a localização');
      return;
    }

    // Verificar cobertura de indústrias antes do checkout
    try {
      console.log('📦 [Checkout] Verificando cobertura de indústrias...');
      const coverage = await industryService.getVisitCoverage(visit.id);
      
      if (!coverage.isComplete && coverage.pending.length > 0) {
        const pendingNames = coverage.pending.map((p: any) => p.industry.name).join(', ');
        const percentComplete = coverage.percentComplete;
        
        Alert.alert(
          '⚠️ Indústrias Pendentes',
          `Esta loja requer fotos de ${coverage.totalRequired} indústrias.\n\n` +
          `Você cobriu ${coverage.totalCovered} de ${coverage.totalRequired} (${percentComplete}%).\n\n` +
          `Faltam: ${pendingNames}`,
          [
            { 
              text: 'Voltar e completar', 
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
            { 
              text: 'Checkout mesmo assim', 
              style: 'destructive',
              onPress: () => proceedWithCheckout(currentLocation!),
            },
          ]
        );
        return;
      }
      
      console.log('✅ [Checkout] Cobertura completa, prosseguindo...');
    } catch (error) {
      // Se falhar a verificação de cobertura, continuar com checkout
      console.warn('⚠️ [Checkout] Erro ao verificar cobertura, prosseguindo:', error);
    }

    // Prosseguir com checkout
    proceedWithCheckout(currentLocation);
  }

  function calculateDuration() {
    if (!checkInTime) return '0h';
    const now = new Date();
    const diff = now.getTime() - checkInTime.getTime();
    const hours = (diff / (1000 * 60 * 60)).toFixed(2);
    return `${hours}h`;
  }

  if (!visit) {
    return (
      <View style={styles.container}>
        <Card style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Visita não encontrada</Text>
          <Text style={styles.errorText}>
            Não foi possível encontrar a visita ativa. Tente novamente.
          </Text>
          <Button
            variant="primary"
            size="md"
            onPress={() => navigation.navigate('Home')}
            style={styles.errorButton}
          >
            Voltar ao Início
          </Button>
        </Card>
      </View>
    );
  }

  if (cameraPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (cameraPermission === false) {
    return (
      <View style={styles.container}>
        <Card style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Permissão de Câmera Necessária</Text>
          <Text style={styles.permissionText}>
            Precisamos do acesso à câmera para tirar fotos da fachada das lojas.
          </Text>
          <Button variant="primary" size="lg" onPress={requestCameraPermission} style={styles.permissionButton}>
            Permitir Câmera
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.subtitle}>Finalize sua visita</Text>
      </View>

      {/* Informações da Visita */}
      <Card style={styles.visitCard} shadow>
        <View style={styles.visitHeader}>
          <View style={styles.visitIcon}>
            <Text style={styles.visitIconText}>🏪</Text>
          </View>
          <View style={styles.visitInfo}>
            <Text style={styles.visitStoreName}>{visit.store.name}</Text>
            <Text style={styles.visitStoreAddress}>{visit.store.address}</Text>
          </View>
        </View>
        {checkInTime && (
          <View style={styles.visitDuration}>
            <View style={styles.durationItem}>
              <Text style={styles.durationLabel}>Check-in</Text>
              <Text style={styles.durationValue}>
                {checkInTime.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.durationItem}>
              <Text style={styles.durationLabel}>Duração</Text>
              <Text style={[styles.durationValue, styles.durationValueHighlight]}>
                {calculateDuration()}
              </Text>
            </View>
          </View>
        )}
      </Card>

      {/* Preview da Foto ou Câmera */}
      {showPreview && photoUri ? (
        <Card style={styles.previewCard} shadow>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Preview da Foto</Text>
            <TouchableOpacity
              onPress={() => {
                setPhotoUri(null);
                setShowPreview(false);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <View style={styles.previewActions}>
            <Button
              variant="outline"
              size="md"
              onPress={() => {
                setPhotoUri(null);
                setShowPreview(false);
              }}
              style={styles.previewButton}
            >
              Tirar Outra
            </Button>
          </View>
        </Card>
      ) : (
        <Card style={styles.cameraCard} shadow>
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraIcon}>📷</Text>
            <Text style={styles.cameraText}>Pronto para tirar foto</Text>
          </View>
        </Card>
      )}

      {/* Status */}
      <Card style={styles.statusCard} shadow>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusIndicator,
                location ? styles.statusIndicatorActive : undefined,
              ]}
            >
              <Text style={styles.statusIcon}>{location ? '✓' : '○'}</Text>
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Localização</Text>
              <Text style={styles.statusValue}>
                {locationLoading ? 'Obtendo...' : location ? 'Obtida' : 'Pendente'}
              </Text>
            </View>
          </View>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusIndicator,
                photoUri ? styles.statusIndicatorActive : undefined,
              ]}
            >
              <Text style={styles.statusIcon}>{photoUri ? '✓' : '○'}</Text>
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Foto</Text>
              <Text style={styles.statusValue}>{photoUri ? 'Capturada' : 'Pendente'}</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Pendências de sincronização */}
      {(pendingPhotosCount > 0 || pendingSurveysCount > 0) && (
        <Card style={styles.pendingSyncCard} shadow>
          <Text style={styles.pendingSyncTitle}>Itens pendentes de sincronização</Text>
          <Text style={styles.pendingSyncDetail}>
            {pendingPhotosCount} foto(s) e {pendingSurveysCount} pesquisa(s) serão enviadas quando houver internet.
          </Text>
        </Card>
      )}

      {/* Ações */}
      <View style={styles.actions}>
        {!showPreview && (
          <Button
            variant="accent"
            size="lg"
            onPress={takePhoto}
            disabled={loading}
            style={styles.actionButton}
          >
            Tirar Foto
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          onPress={handleCheckout}
          isLoading={loading}
          disabled={!photoUri || !location || loading}
          style={styles.actionButton}
        >
          Finalizar Checkout
        </Button>
      </View>
      </ScrollView>

      <Modal visible={justifyModalOpen} transparent animationType="slide" onRequestClose={() => setJustifyModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Justifique as indústrias pendentes</Text>
            <Text style={styles.modalSubtitle}>
              Para finalizar o checkout, selecione um motivo para cada indústria que não foi fotografada nesta loja.
            </Text>

            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingVertical: 8 }}>
              {justifyPendingIndustries.map((ind) => {
                const sel = justifySelections[ind.id] || {};
                return (
                  <View key={ind.id} style={styles.justifyRow}>
                    <Text style={styles.justifyIndustryName}>
                      {(ind.abbreviation || ind.code) ? `[${ind.abbreviation || ind.code}] ` : ''}{ind.name}
                    </Text>
                    <TouchableOpacity
                      style={styles.justifyPickButton}
                      onPress={() => {
                        const buttons = (justifyReasonOptions.length > 0 ? justifyReasonOptions : [
                          { code: 'STORE_CLOSED', label: 'Loja fechada' },
                          { code: 'NO_STOCK', label: 'Sem estoque' },
                          { code: 'NO_AUTHORIZATION', label: 'Sem autorização' },
                          { code: 'NO_MATERIAL', label: 'Sem material' },
                          { code: 'PROMOTER_ERROR', label: 'Erro do promotor' },
                          { code: 'OTHER', label: 'Outro' },
                        ]).map((opt) => ({
                          text: opt.label,
                          onPress: () => {
                            setJustifySelections((prev) => ({ ...prev, [ind.id]: { ...prev[ind.id], reason: opt.code } }));
                          },
                        }));
                        Alert.alert('Motivo', 'Selecione um motivo', [
                          ...buttons,
                          { text: 'Cancelar', style: 'cancel' },
                        ]);
                      }}
                    >
                      <Text style={styles.justifyPickButtonText}>
                        {sel.reason ? `Motivo: ${sel.reason}` : 'Selecionar motivo'}
                      </Text>
                    </TouchableOpacity>
                    <TextInput
                      placeholder="Observação (opcional)"
                      placeholderTextColor={colors.text.tertiary}
                      value={sel.note || ''}
                      onChangeText={(text) => setJustifySelections((prev) => ({ ...prev, [ind.id]: { ...prev[ind.id], note: text } }))}
                      style={styles.justifyNote}
                      multiline
                    />
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button variant="outline" size="md" onPress={() => setJustifyModalOpen(false)} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button
                variant="accent"
                size="md"
                onPress={async () => {
                  if (!visit) return;
                  const missing = justifyPendingIndustries.filter((ind) => !justifySelections[ind.id]?.reason);
                  if (missing.length > 0) {
                    Alert.alert('Atenção', 'Selecione um motivo para todas as indústrias pendentes.');
                    return;
                  }
                  const items = justifyPendingIndustries.map((ind) => ({
                    industryId: ind.id,
                    reason: justifySelections[ind.id].reason as any,
                    note: justifySelections[ind.id].note,
                  }));
                  try {
                    setLoading(true);
                    await visitService.justifyMissingIndustries(visit.id, items);
                    setJustifyModalOpen(false);

                    // Finalizar checkout com o payload já preparado (sem reupload)
                    if (pendingCheckoutPayload) {
                      await completeCheckout(pendingCheckoutPayload);
                    } else {
                      Alert.alert('Ok', 'Justificativas registradas. Tente finalizar o checkout novamente.');
                    }
                  } catch (e: any) {
                    Alert.alert('Erro', e?.response?.data?.message || 'Não foi possível enviar justificativas.');
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ flex: 1 }}
              >
                Enviar e finalizar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
  },
  visitCard: {
    marginBottom: theme.spacing.lg,
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  visitIcon: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.full,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  visitIconText: {
    fontSize: 24,
  },
  visitInfo: {
    flex: 1,
  },
  visitStoreName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  visitStoreAddress: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.secondary,
  },
  visitDuration: {
    flexDirection: 'row',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
    gap: theme.spacing.lg,
  },
  durationItem: {
    flex: 1,
  },
  durationLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  durationValue: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: colors.text.primary,
  },
  durationValueHighlight: {
    color: colors.primary[600],
    fontWeight: theme.typography.fontWeight.bold,
  },
  cameraCard: {
    marginBottom: theme.spacing.lg,
    minHeight: 200,
  },
  cameraPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.card,
    borderRadius: theme.borderRadius.lg,
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  cameraText: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
  },
  previewCard: {
    marginBottom: theme.spacing.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  previewTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text.secondary,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  previewActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  previewButton: {
    flex: 1,
  },
  statusCard: {
    marginBottom: theme.spacing.lg,
  },
  statusRow: {
    gap: theme.spacing.md,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  statusIndicatorActive: {
    backgroundColor: '#22c55e20',
  },
  statusIcon: {
    fontSize: 20,
    fontWeight: theme.typography.fontWeight.bold,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: colors.text.primary,
  },
  actions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  actionButton: {
    width: '100%',
  },
  permissionCard: {
    margin: theme.spacing.xl,
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  permissionTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  permissionButton: {
    width: '100%',
  },
  errorCard: {
    margin: theme.spacing.xl,
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  errorTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  errorText: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  errorButton: {
    width: '100%',
  },
  pendingSyncCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  pendingSyncTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#f59e0b',
    marginBottom: theme.spacing.xs,
  },
  pendingSyncDetail: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.dark.card,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.border,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 10,
  },
  justifyRow: {
    borderWidth: 1,
    borderColor: colors.dark.border,
    backgroundColor: colors.dark.cardElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  justifyIndustryName: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 8,
  },
  justifyPickButton: {
    borderWidth: 1,
    borderColor: colors.primary[600],
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  justifyPickButtonText: {
    color: colors.primary[400],
    fontWeight: '600',
  },
  justifyNote: {
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: colors.text.primary,
    minHeight: 44,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
});
