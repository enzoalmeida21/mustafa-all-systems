import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllPendingVisitIds,
  getPendingPhotosForSync,
  getPendingSurveysForSync,
  updatePhotoSyncStatus,
  updateSurveySyncStatus,
  cleanupSyncedData,
  getActiveVisit,
  saveActiveVisit,
} from '../features/visits/visitFlowStorage';
import { LocalPhoto, LocalPriceSurvey } from '../features/visits/types';
import { photoService } from './photoService';
import { visitService } from './visitService';

type SyncEventCallback = (event: SyncEvent) => void;

export interface SyncEvent {
  type: 'start' | 'progress' | 'photoSynced' | 'surveySynced' | 'error' | 'complete';
  visitId?: string;
  localId?: string;
  total?: number;
  synced?: number;
  failed?: number;
  message?: string;
}

interface SyncResult {
  totalPhotos: number;
  syncedPhotos: number;
  failedPhotos: number;
  totalSurveys: number;
  syncedSurveys: number;
  failedSurveys: number;
}

let isSyncing = false;
const listeners: Set<SyncEventCallback> = new Set();

function emit(event: SyncEvent) {
  listeners.forEach((cb) => {
    try { cb(event); } catch (_) {}
  });
}

export const offlineSyncService = {
  addListener(cb: SyncEventCallback) {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  },

  isSyncing(): boolean {
    return isSyncing;
  },

  async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return !!(state.isConnected && state.isInternetReachable !== false);
    } catch {
      return false;
    }
  },

  async syncAll(): Promise<SyncResult> {
    if (isSyncing) {
      return { totalPhotos: 0, syncedPhotos: 0, failedPhotos: 0, totalSurveys: 0, syncedSurveys: 0, failedSurveys: 0 };
    }

    const online = await this.isOnline();
    if (!online) {
      emit({ type: 'error', message: 'Sem conexão com internet' });
      return { totalPhotos: 0, syncedPhotos: 0, failedPhotos: 0, totalSurveys: 0, syncedSurveys: 0, failedSurveys: 0 };
    }

    isSyncing = true;
    const result: SyncResult = {
      totalPhotos: 0, syncedPhotos: 0, failedPhotos: 0,
      totalSurveys: 0, syncedSurveys: 0, failedSurveys: 0,
    };

    try {
      emit({ type: 'start' });
      const visitIds = await getAllPendingVisitIds();

      for (const visitId of visitIds) {
        const pendingPhotos = await getPendingPhotosForSync(visitId);
        const pendingSurveys = await getPendingSurveysForSync(visitId);
        result.totalPhotos += pendingPhotos.length;
        result.totalSurveys += pendingSurveys.length;

        for (const photo of pendingPhotos) {
          try {
            await this.syncPhoto(visitId, photo);
            result.syncedPhotos++;
            emit({
              type: 'photoSynced',
              visitId,
              localId: photo.localId,
              synced: result.syncedPhotos,
              total: result.totalPhotos,
            });
          } catch (err: any) {
            result.failedPhotos++;
            emit({
              type: 'error',
              visitId,
              localId: photo.localId,
              message: err?.message || 'Erro ao sincronizar foto',
            });
          }
        }

        for (const survey of pendingSurveys) {
          try {
            await this.syncSurvey(visitId, survey);
            result.syncedSurveys++;
            emit({
              type: 'surveySynced',
              visitId,
              localId: survey.localId,
              synced: result.syncedSurveys,
              total: result.totalSurveys,
            });
          } catch (err: any) {
            result.failedSurveys++;
            emit({
              type: 'error',
              visitId,
              localId: survey.localId,
              message: err?.message || 'Erro ao sincronizar pesquisa',
            });
          }
        }

        await cleanupSyncedData(visitId);
      }

      // Update hasPendingSync on active visit (try to find current user's visit)
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const visitKey = allKeys.find(k => k.startsWith('@mustafa/active_visit_'));
        if (visitKey) {
          const userId = visitKey.replace('@mustafa/active_visit_', '');
          const activeVisit = await getActiveVisit(userId);
          if (activeVisit) {
            const remainingPhotos = await getPendingPhotosForSync(activeVisit.visitId);
            const remainingSurveys = await getPendingSurveysForSync(activeVisit.visitId);
            const stillPending = remainingPhotos.length > 0 || remainingSurveys.length > 0;
            if (activeVisit.hasPendingSync !== stillPending) {
              activeVisit.hasPendingSync = stillPending;
              activeVisit.updatedAt = new Date().toISOString();
              await saveActiveVisit(activeVisit);
            }
          }
        }
      } catch {}


      emit({
        type: 'complete',
        synced: result.syncedPhotos + result.syncedSurveys,
        failed: result.failedPhotos + result.failedSurveys,
        total: result.totalPhotos + result.totalSurveys,
      });
    } catch (err: any) {
      emit({ type: 'error', message: err?.message || 'Erro geral de sincronização' });
    } finally {
      isSyncing = false;
    }

    return result;
  },

  async syncPhoto(visitId: string, photo: LocalPhoto): Promise<void> {
    await updatePhotoSyncStatus(visitId, photo.localId, 'uploading');

    try {
      const { presignedUrl, url } = await photoService.getPresignedUrl({
        visitId,
        type: photo.type,
        contentType: 'image/jpeg',
        extension: 'jpg',
      });

      const uploadSuccess = await photoService.uploadToFirebase(presignedUrl, photo.uri, 'image/jpeg');
      if (!uploadSuccess) {
        throw new Error('Upload retornou false');
      }

      await visitService.uploadPhotos({
        visitId,
        photos: [{
          url,
          type: photo.type,
          latitude: photo.latitude ?? undefined,
          longitude: photo.longitude ?? undefined,
        }],
      });

      await updatePhotoSyncStatus(visitId, photo.localId, 'synced', {
        remoteUrl: url,
        storagePath: url,
        errorMessage: undefined,
      });
    } catch (err: any) {
      await updatePhotoSyncStatus(visitId, photo.localId, 'error', {
        errorMessage: err?.message || 'Erro desconhecido',
      });
      throw err;
    }
  },

  async syncSurvey(visitId: string, survey: LocalPriceSurvey): Promise<void> {
    await updateSurveySyncStatus(visitId, survey.localId, 'uploading');

    try {
      await visitService.submitPriceResearch({
        visitId,
        storeId: survey.storeId,
        productName: survey.productName,
        price: survey.price,
        competitorPrices: survey.competitorPrices,
      });

      await updateSurveySyncStatus(visitId, survey.localId, 'synced');
    } catch (err: any) {
      await updateSurveySyncStatus(visitId, survey.localId, 'error', err?.message);
      throw err;
    }
  },

  setupAutoSync() {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        this.syncAll().catch(() => {});
      }
    });
    return unsubscribe;
  },
};
