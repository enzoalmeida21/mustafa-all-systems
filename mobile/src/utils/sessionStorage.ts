import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PendingPhoto {
  id?: string;
  uri: string;
  type: 'FACADE_CHECKIN' | 'FACADE_CHECKOUT' | 'OTHER';
  visitId: string;
  industryId?: string;
  timestamp: number;
}

const PENDING_PHOTOS_PREFIX = 'pending_photos_';

/**
 * Salva fotos pendentes (não enviadas) para uma visita
 */
export async function savePendingPhotos(visitId: string, photos: PendingPhoto[]): Promise<void> {
  try {
    const key = `${PENDING_PHOTOS_PREFIX}${visitId}`;
    await AsyncStorage.setItem(key, JSON.stringify(photos));
    console.log(`[sessionStorage] Salvas ${photos.length} fotos pendentes para visita ${visitId}`);
  } catch (error) {
    console.error('[sessionStorage] Erro ao salvar fotos pendentes:', error);
    throw error;
  }
}

/**
 * Restaura fotos pendentes de uma visita
 */
export async function getPendingPhotos(visitId: string): Promise<PendingPhoto[]> {
  try {
    const key = `${PENDING_PHOTOS_PREFIX}${visitId}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) {
      return [];
    }
    const photos = JSON.parse(data) as PendingPhoto[];
    console.log(`[sessionStorage] Restauradas ${photos.length} fotos pendentes para visita ${visitId}`);
    return photos;
  } catch (error) {
    console.error('[sessionStorage] Erro ao restaurar fotos pendentes:', error);
    return [];
  }
}

/**
 * Limpa fotos pendentes de uma visita (após upload bem-sucedido)
 */
export async function clearPendingPhotos(visitId: string): Promise<void> {
  try {
    const key = `${PENDING_PHOTOS_PREFIX}${visitId}`;
    await AsyncStorage.removeItem(key);
    console.log(`[sessionStorage] Fotos pendentes limpas para visita ${visitId}`);
  } catch (error) {
    console.error('[sessionStorage] Erro ao limpar fotos pendentes:', error);
  }
}

/**
 * Obtém todas as visitas com fotos pendentes
 */
export async function getAllPendingVisits(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pendingKeys = keys.filter(key => key.startsWith(PENDING_PHOTOS_PREFIX));
    return pendingKeys.map(key => key.replace(PENDING_PHOTOS_PREFIX, ''));
  } catch (error) {
    console.error('[sessionStorage] Erro ao obter visitas pendentes:', error);
    return [];
  }
}

/**
 * Limpa todas as fotos pendentes (útil para limpeza geral)
 */
export async function clearAllPendingPhotos(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pendingKeys = keys.filter(key => key.startsWith(PENDING_PHOTOS_PREFIX));
    await AsyncStorage.multiRemove(pendingKeys);
    console.log(`[sessionStorage] Limpas ${pendingKeys.length} chaves de fotos pendentes`);
  } catch (error) {
    console.error('[sessionStorage] Erro ao limpar todas as fotos pendentes:', error);
  }
}

