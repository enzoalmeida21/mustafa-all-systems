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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { visitService } from '../services/visitService';
import { photoService } from '../services/photoService';
import { useVisitFlow } from '../features/visits';
import { useAuth } from '../context/AuthContext';
import { colors, theme } from '../styles/theme';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { requestForegroundPermissions, getCurrentPosition, LocationObject } from '../utils/locationHelper';

interface Store {
  id: string;
  name: string;
  address: string;
}


type RootStackParamList = {
  ActiveVisit: { visit: any };
};

export default function CheckInScreen({ route }: any) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { store } = route.params || {};
  const { user } = useAuth();
  const { startVisit, setCheckedIn } = useVisitFlow();
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

  useEffect(() => {
    requestLocationPermission();
    requestCameraPermission();
  }, []);

  async function requestLocationPermission() {
    try {
      const permission = await requestForegroundPermissions();
      setLocationPermission(permission.status === 'granted');
      
      if (permission.status === 'granted') {
        const loc = await getCurrentPosition();
        setLocation(loc);
      } else {
        Alert.alert(
          'Permissão necessária',
          'É necessário permitir o acesso à localização para fazer check-in.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Tentar novamente', onPress: requestLocationPermission },
          ]
        );
      }
    } catch (error: any) {
      console.error('Erro ao solicitar permissão de localização:', error);
      Alert.alert('Erro', error?.message || 'Não foi possível solicitar permissão de localização');
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
      }
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      Alert.alert('Erro', 'Não foi possível capturar a foto');
    }
  }

  async function handleCheckIn() {
    if (!store) {
      Alert.alert('Erro', 'Selecione uma loja primeiro');
      return;
    }

    if (!location) {
      Alert.alert('Erro', 'Não foi possível obter a localização');
      return;
    }

    if (!photoUri) {
      Alert.alert('Erro', 'Tire uma foto da fachada primeiro');
      return;
    }

    setLoading(true);
    try {
      // Persistir localmente antes de chamar o backend
      await startVisit({
        storeId: store.id,
        storeName: store.name,
        storeAddress: store.address,
        promoterId: user?.id || 'unknown',
      });

      const tempPhotoUrl = 'https://placeholder.com/checkin.jpg';
      
      const checkInResult = await visitService.checkIn({
        storeId: store.id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        photoUrl: tempPhotoUrl,
      });

      const visitId = checkInResult.visit?.id;
      if (!visitId) {
        throw new Error('Não foi possível obter o ID da visita');
      }

      // Transição local: visitInProgress -> checkedIn
      await setCheckedIn(visitId, location.coords.latitude, location.coords.longitude);

      // 2. Agora que temos o visitId real, fazer upload da foto
      console.log('📸 [CheckIn] Obtendo presigned URL com visitId real...');
      let photoUrl = '';
      
      try {
        const { presignedUrl, url } = await photoService.getPresignedUrl({
          visitId: visitId,
          type: 'FACADE_CHECKIN',
          contentType: 'image/jpeg',
          extension: 'jpg',
        });

        console.log('📸 [CheckIn] Presigned URL obtida:', presignedUrl ? 'Sim' : 'Não');
        console.log('📸 [CheckIn] URL final:', url);

        // 3. Upload da foto para Firebase Storage
        if (presignedUrl && photoUri) {
          console.log('📸 [CheckIn] Fazendo upload da foto...');
          const uploadSuccess = await photoService.uploadToFirebase(presignedUrl, photoUri, 'image/jpeg');
          
          if (uploadSuccess) {
            console.log('✅ [CheckIn] Upload da foto concluído com sucesso');
            photoUrl = url; // URL pública do Firebase
          } else {
            console.error('❌ [CheckIn] Upload da foto falhou');
            throw new Error('Falha no upload da foto');
          }
        } else {
          throw new Error('Presigned URL ou photoUri não disponível');
        }
      } catch (uploadError: any) {
        console.error('❌ [CheckIn] Erro no upload da foto:', uploadError);
        // Continuar mesmo se o upload falhar - a visita já foi criada
        console.warn('⚠️ [CheckIn] Visita criada, mas upload da foto falhou');
        photoUrl = tempPhotoUrl; // Manter URL temporária
      }

      // 4. Atualizar o registro da foto com a URL correta
      if (photoUrl && photoUrl !== tempPhotoUrl) {
        console.log('📸 [CheckIn] Atualizando registro da foto com URL correta...');
        try {
          // Usar uploadPhotos para atualizar/criar o registro correto
          // O PhotoGallery prioriza photos[] sobre checkInPhotoUrl
          await visitService.uploadPhotos({
            visitId: visitId,
            photos: [{
              url: photoUrl,
              type: 'FACADE_CHECKIN',
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }],
          });
          console.log('✅ [CheckIn] Registro da foto atualizado');
        } catch (updateError: any) {
          console.warn('⚠️ [CheckIn] Erro ao atualizar registro da foto:', updateError);
          // Continuar mesmo se falhar - a foto já está no Firebase
        }
      }

      const result = checkInResult;
      console.log('✅ [CheckIn] Check-in realizado com sucesso:', result);

      Alert.alert('✅ Sucesso', 'Check-in realizado com sucesso!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('ActiveVisit', { visit: result.visit });
          },
        },
      ]);
    } catch (error: any) {
      console.error('❌ [CheckIn] Erro no check-in:', error);
      console.error('❌ [CheckIn] Tipo do erro:', error?.constructor?.name);
      console.error('❌ [CheckIn] Mensagem:', error?.message);
      console.error('❌ [CheckIn] Response:', error?.response?.data);
      console.error('❌ [CheckIn] Status:', error?.response?.status);
      console.error('❌ [CheckIn] Stack:', error?.stack);
      
      const errorMessage = 
        error?.response?.data?.message || 
        error?.message || 
        'Erro ao fazer check-in. Verifique sua conexão e tente novamente.';
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Check-in</Text>
        <Text style={styles.subtitle}>Tire uma foto da fachada da loja</Text>
      </View>

      {/* Informações da Loja */}
      {store && (
        <Card style={styles.storeCard} shadow>
          <View style={styles.storeHeader}>
            <View style={styles.storeIcon}>
              <Text style={styles.storeIconText}>🏪</Text>
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{store.name}</Text>
              <Text style={styles.storeAddress}>{store.address}</Text>
            </View>
          </View>
        </Card>
      )}

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

      {/* Status de Localização */}
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
                {location
                  ? `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`
                  : 'Obtendo...'}
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
            📷 Tirar Foto
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          onPress={handleCheckIn}
          isLoading={loading}
          disabled={!photoUri || !location || loading}
          style={styles.actionButton}
        >
          ✅ Fazer Check-in
        </Button>
      </View>
    </ScrollView>
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
  storeCard: {
    marginBottom: theme.spacing.lg,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIcon: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  storeIconText: {
    fontSize: 24,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  storeAddress: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.secondary,
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
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
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
});
