import { useState, useEffect, useCallback, useRef } from 'react';
import {
  VisitStatus,
  LocalVisit,
  LocalPhoto,
  LocalPriceSurvey,
  canTransition,
  generateVisitKey,
} from './types';
import {
  saveActiveVisit,
  getActiveVisit,
  clearActiveVisit,
  getPhotos,
  addPhoto as addPhotoStorage,
  getSurveys,
  addSurvey as addSurveyStorage,
  getPendingPhotosForSync,
  getPendingSurveysForSync,
  migrateLegacyVisit,
  migrateVisitStorageToServerId,
} from './visitFlowStorage';

/** Resposta de GET /promoters/current-visit (campos usados no app). */
export interface ServerCurrentVisitPayload {
  id: string;
  store: {
    id: string;
    name: string;
    address?: string | null;
  };
  checkInAt: string;
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
}

let _useAuth: (() => { user: { id: string } | null }) | undefined;
try {
  _useAuth = require('../../context/AuthContext').useAuth;
} catch {}

interface UseVisitFlowReturn {
  visit: LocalVisit | null;
  photos: LocalPhoto[];
  surveys: LocalPriceSurvey[];
  loading: boolean;
  pendingPhotosCount: number;
  pendingSurveysCount: number;
  startVisit: (params: {
    storeId: string;
    storeName: string;
    storeAddress: string;
    promoterId: string;
  }) => Promise<LocalVisit>;
  setCheckedIn: (visitId: string, latitude: number, longitude: number) => Promise<void>;
  setWorking: () => Promise<void>;
  setStoreCompleted: () => Promise<void>;
  setCheckedOut: (latitude: number, longitude: number) => Promise<void>;
  addPhoto: (photo: LocalPhoto) => Promise<void>;
  addSurvey: (survey: LocalPriceSurvey) => Promise<void>;
  refreshData: () => Promise<void>;
  clearVisit: () => Promise<void>;
  syncFromServerCurrentVisit: (serverVisit: ServerCurrentVisitPayload) => Promise<void>;
  isActiveVisit: boolean;
}

export function useVisitFlow(): UseVisitFlowReturn {
  const authResult = _useAuth ? _useAuth() : null;
  const currentUserId = authResult?.user?.id ?? null;

  const [visit, setVisit] = useState<LocalVisit | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [surveys, setSurveys] = useState<LocalPriceSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      initialized.current = false;
      lastUserId.current = null;
      setVisit(null);
      setPhotos([]);
      setSurveys([]);
      setLoading(false);
      return;
    }
    if (!initialized.current || lastUserId.current !== currentUserId) {
      initialized.current = true;
      lastUserId.current = currentUserId;
      loadPersistedState(currentUserId);
    }
  }, [currentUserId]);

  const loadPersistedState = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      await migrateLegacyVisit(userId);
      const persisted = await getActiveVisit(userId);
      if (persisted && persisted.status !== 'checkedOut' && persisted.status !== 'idle') {
        setVisit(persisted);
        const [storedPhotos, storedSurveys] = await Promise.all([
          getPhotos(persisted.visitId),
          getSurveys(persisted.visitId),
        ]);
        setPhotos(storedPhotos);
        setSurveys(storedSurveys);
      } else {
        setVisit(null);
        setPhotos([]);
        setSurveys([]);
      }
    } catch (error) {
      console.error('[useVisitFlow] Erro ao restaurar estado:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const transition = useCallback(
    async (to: VisitStatus, updates: Partial<LocalVisit> = {}) => {
      // Read from storage as source of truth (React state may be stale)
      let current = visit;
      if (!current && currentUserId) {
        current = await getActiveVisit(currentUserId);
      }
      if (!current) throw new Error('Nenhuma visita ativa para transição');
      if (!canTransition(current.status, to)) {
        throw new Error(`Transição inválida: ${current.status} -> ${to}`);
      }
      const updated: LocalVisit = {
        ...current,
        ...updates,
        status: to,
        updatedAt: new Date().toISOString(),
      };
      await saveActiveVisit(updated);
      setVisit(updated);
      return updated;
    },
    [visit, currentUserId]
  );

  const startVisit = useCallback(
    async (params: {
      storeId: string;
      storeName: string;
      storeAddress: string;
      promoterId: string;
    }): Promise<LocalVisit> => {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const visitKey = generateVisitKey(params.promoterId, params.storeId, date);
      const newVisit: LocalVisit = {
        visitId: visitKey,
        promoterId: params.promoterId,
        storeId: params.storeId,
        storeName: params.storeName,
        storeAddress: params.storeAddress,
        date,
        status: 'visitInProgress',
        checkinAt: null,
        checkoutAt: null,
        checkinLatitude: null,
        checkinLongitude: null,
        checkoutLatitude: null,
        checkoutLongitude: null,
        hasPendingSync: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await saveActiveVisit(newVisit);
      setVisit(newVisit);
      setPhotos([]);
      setSurveys([]);
      return newVisit;
    },
    []
  );

  const setCheckedIn = useCallback(
    async (visitId: string, latitude: number, longitude: number) => {
      await transition('checkedIn', {
        visitId,
        checkinAt: new Date().toISOString(),
        checkinLatitude: latitude,
        checkinLongitude: longitude,
      });
    },
    [transition]
  );

  const setWorking = useCallback(async () => {
    // Read from storage to get latest status
    let current = visit;
    if (currentUserId && !current) {
      current = await getActiveVisit(currentUserId);
    }
    if (current && current.status === 'checkedIn') {
      await transition('working');
    }
  }, [visit, currentUserId, transition]);

  const setStoreCompleted = useCallback(async () => {
    const pending = visit ? await getPendingPhotosForSync(visit.visitId) : [];
    const pendingSurveys = visit ? await getPendingSurveysForSync(visit.visitId) : [];
    await transition('storeCompleted', {
      hasPendingSync: pending.length > 0 || pendingSurveys.length > 0,
    });
  }, [visit, transition]);

  const setCheckedOut = useCallback(
    async (latitude: number, longitude: number) => {
      await transition('checkedOut', {
        checkoutAt: new Date().toISOString(),
        checkoutLatitude: latitude,
        checkoutLongitude: longitude,
      });
    },
    [transition]
  );

  const addPhotoToVisit = useCallback(
    async (photo: LocalPhoto) => {
      if (!visit) throw new Error('Nenhuma visita ativa');
      const updated = await addPhotoStorage(visit.visitId, photo);
      setPhotos(updated);
    },
    [visit]
  );

  const addSurveyToVisit = useCallback(
    async (survey: LocalPriceSurvey) => {
      if (!visit) throw new Error('Nenhuma visita ativa');
      const updated = await addSurveyStorage(visit.visitId, survey);
      setSurveys(updated);
    },
    [visit]
  );

  const refreshData = useCallback(async () => {
    if (!visit) return;
    const [storedPhotos, storedSurveys] = await Promise.all([
      getPhotos(visit.visitId),
      getSurveys(visit.visitId),
    ]);
    setPhotos(storedPhotos);
    setSurveys(storedSurveys);
  }, [visit]);

  const clearVisitFn = useCallback(async () => {
    if (currentUserId) {
      await clearActiveVisit(currentUserId);
    }
    setVisit(null);
    setPhotos([]);
    setSurveys([]);
  }, [currentUserId]);

  const syncFromServerCurrentVisit = useCallback(
    async (serverVisit: ServerCurrentVisitPayload) => {
      if (!currentUserId) return;
      const existing = await getActiveVisit(currentUserId);
      const oldVisitId =
        existing && existing.visitId !== serverVisit.id ? existing.visitId : null;
      if (oldVisitId) {
        await migrateVisitStorageToServerId(oldVisitId, serverVisit.id);
      }

      const checkInRaw = serverVisit.checkInAt;
      const checkInIso =
        typeof checkInRaw === 'string'
          ? checkInRaw
          : new Date(checkInRaw as unknown as Date).toISOString();
      const date = checkInIso.split('T')[0];

      const pendingPhotos = await getPendingPhotosForSync(serverVisit.id);
      const pendingSurveys = await getPendingSurveysForSync(serverVisit.id);
      const hasPendingSync = pendingPhotos.length > 0 || pendingSurveys.length > 0;

      const local: LocalVisit = {
        visitId: serverVisit.id,
        promoterId: currentUserId,
        storeId: serverVisit.store.id,
        storeName: serverVisit.store.name,
        storeAddress: serverVisit.store.address ?? '',
        date,
        status: 'working',
        checkinAt: checkInIso,
        checkoutAt: null,
        checkinLatitude: serverVisit.checkInLatitude ?? null,
        checkinLongitude: serverVisit.checkInLongitude ?? null,
        checkoutLatitude: null,
        checkoutLongitude: null,
        hasPendingSync: hasPendingSync || (existing?.hasPendingSync ?? false),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveActiveVisit(local);
      setVisit(local);
      const [storedPhotos, storedSurveys] = await Promise.all([
        getPhotos(local.visitId),
        getSurveys(local.visitId),
      ]);
      setPhotos(storedPhotos);
      setSurveys(storedSurveys);
    },
    [currentUserId]
  );

  const pendingPhotosCount = photos.filter(
    (p: LocalPhoto) => p.syncStatus === 'pending' || p.syncStatus === 'error'
  ).length;

  const pendingSurveysCount = surveys.filter(
    (s: LocalPriceSurvey) => s.syncStatus === 'pending' || s.syncStatus === 'error'
  ).length;

  return {
    visit,
    photos,
    surveys,
    loading,
    pendingPhotosCount,
    pendingSurveysCount,
    startVisit,
    setCheckedIn,
    setWorking,
    setStoreCompleted,
    setCheckedOut,
    addPhoto: addPhotoToVisit,
    addSurvey: addSurveyToVisit,
    refreshData,
    clearVisit: clearVisitFn,
    syncFromServerCurrentVisit,
    isActiveVisit: visit !== null && visit.status !== 'idle' && visit.status !== 'checkedOut',
  };
}
