import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LocalVisit,
  LocalPhoto,
  LocalPriceSurvey,
  SyncStatus,
} from './types';

const LEGACY_ACTIVE_VISIT_KEY = '@mustafa/active_visit';

function activeVisitKey(userId: string): string {
  return `@mustafa/active_visit_${userId}`;
}

const KEYS = {
  PHOTOS_PREFIX: '@mustafa/photos_',
  SURVEYS_PREFIX: '@mustafa/surveys_',
  SYNC_QUEUE: '@mustafa/sync_queue',
};

export async function migrateLegacyVisit(userId: string): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_ACTIVE_VISIT_KEY);
    if (legacy) {
      const visit = JSON.parse(legacy);
      if (visit.promoterId === userId) {
        await AsyncStorage.setItem(activeVisitKey(userId), legacy);
      }
      await AsyncStorage.removeItem(LEGACY_ACTIVE_VISIT_KEY);
    }
  } catch {}
}

// ── Active Visit ──

export async function saveActiveVisit(visit: LocalVisit): Promise<void> {
  await AsyncStorage.setItem(activeVisitKey(visit.promoterId), JSON.stringify(visit));
}

export async function getActiveVisit(userId: string): Promise<LocalVisit | null> {
  const raw = await AsyncStorage.getItem(activeVisitKey(userId));
  return raw ? JSON.parse(raw) : null;
}

export async function clearActiveVisit(userId: string): Promise<void> {
  await AsyncStorage.removeItem(activeVisitKey(userId));
}

// ── Photos ──

function photosKey(visitId: string): string {
  return `${KEYS.PHOTOS_PREFIX}${visitId}`;
}

export async function savePhotos(visitId: string, photos: LocalPhoto[]): Promise<void> {
  await AsyncStorage.setItem(photosKey(visitId), JSON.stringify(photos));
}

export async function getPhotos(visitId: string): Promise<LocalPhoto[]> {
  const raw = await AsyncStorage.getItem(photosKey(visitId));
  return raw ? JSON.parse(raw) : [];
}

export async function addPhoto(visitId: string, photo: LocalPhoto): Promise<LocalPhoto[]> {
  const photos = await getPhotos(visitId);
  photos.push(photo);
  await savePhotos(visitId, photos);
  return photos;
}

export async function updatePhotoSyncStatus(
  visitId: string,
  localId: string,
  syncStatus: SyncStatus,
  extra?: { remoteUrl?: string; storagePath?: string; errorMessage?: string }
): Promise<void> {
  const photos = await getPhotos(visitId);
  const idx = photos.findIndex((p) => p.localId === localId);
  if (idx >= 0) {
    photos[idx].syncStatus = syncStatus;
    if (extra?.remoteUrl) photos[idx].remoteUrl = extra.remoteUrl;
    if (extra?.storagePath) photos[idx].storagePath = extra.storagePath;
    if (extra?.errorMessage !== undefined) photos[idx].errorMessage = extra.errorMessage;
    if (syncStatus === 'synced') photos[idx].syncedAt = new Date().toISOString();
    await savePhotos(visitId, photos);
  }
}

export async function clearPhotos(visitId: string): Promise<void> {
  await AsyncStorage.removeItem(photosKey(visitId));
}

// ── Price Surveys ──

function surveysKey(visitId: string): string {
  return `${KEYS.SURVEYS_PREFIX}${visitId}`;
}

export async function saveSurveys(visitId: string, surveys: LocalPriceSurvey[]): Promise<void> {
  await AsyncStorage.setItem(surveysKey(visitId), JSON.stringify(surveys));
}

export async function getSurveys(visitId: string): Promise<LocalPriceSurvey[]> {
  const raw = await AsyncStorage.getItem(surveysKey(visitId));
  return raw ? JSON.parse(raw) : [];
}

export async function addSurvey(visitId: string, survey: LocalPriceSurvey): Promise<LocalPriceSurvey[]> {
  const surveys = await getSurveys(visitId);
  surveys.push(survey);
  await saveSurveys(visitId, surveys);
  return surveys;
}

export async function updateSurveySyncStatus(
  visitId: string,
  localId: string,
  syncStatus: SyncStatus,
  errorMessage?: string
): Promise<void> {
  const surveys = await getSurveys(visitId);
  const idx = surveys.findIndex((s) => s.localId === localId);
  if (idx >= 0) {
    surveys[idx].syncStatus = syncStatus;
    if (errorMessage !== undefined) surveys[idx].errorMessage = errorMessage;
    if (syncStatus === 'synced') surveys[idx].syncedAt = new Date().toISOString();
    await saveSurveys(visitId, surveys);
  }
}

export async function clearSurveys(visitId: string): Promise<void> {
  await AsyncStorage.removeItem(surveysKey(visitId));
}

/** Quando o backend devolve o UUID real e o app ainda tinha chave local (ex.: pré-check-in), move fotos/pesquisas. */
export async function migrateVisitStorageToServerId(
  oldVisitId: string,
  newVisitId: string
): Promise<void> {
  if (oldVisitId === newVisitId) return;
  const photos = await getPhotos(oldVisitId);
  const surveys = await getSurveys(oldVisitId);
  if (photos.length === 0 && surveys.length === 0) return;
  const migratedPhotos = photos.map((p) => ({ ...p, visitId: newVisitId }));
  const migratedSurveys = surveys.map((s) => ({ ...s, visitId: newVisitId }));
  await savePhotos(newVisitId, migratedPhotos);
  await saveSurveys(newVisitId, migratedSurveys);
  await clearPhotos(oldVisitId);
  await clearSurveys(oldVisitId);
}

// ── Pending sync discovery ──

export async function getAllPendingVisitIds(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  const photoKeys = keys.filter((k) => k.startsWith(KEYS.PHOTOS_PREFIX));
  const surveyKeys = keys.filter((k) => k.startsWith(KEYS.SURVEYS_PREFIX));

  const visitIds = new Set<string>();
  for (const k of photoKeys) {
    visitIds.add(k.replace(KEYS.PHOTOS_PREFIX, ''));
  }
  for (const k of surveyKeys) {
    visitIds.add(k.replace(KEYS.SURVEYS_PREFIX, ''));
  }

  return Array.from(visitIds);
}

export async function getPendingPhotosForSync(visitId: string): Promise<LocalPhoto[]> {
  const photos = await getPhotos(visitId);
  return photos.filter((p) => p.syncStatus === 'pending' || p.syncStatus === 'error');
}

export async function getPendingSurveysForSync(visitId: string): Promise<LocalPriceSurvey[]> {
  const surveys = await getSurveys(visitId);
  return surveys.filter((s) => s.syncStatus === 'pending' || s.syncStatus === 'error');
}

export async function cleanupSyncedData(visitId: string): Promise<void> {
  const photos = await getPhotos(visitId);
  const surveys = await getSurveys(visitId);
  const allPhotosSynced = photos.length === 0 || photos.every((p) => p.syncStatus === 'synced');
  const allSurveysSynced = surveys.length === 0 || surveys.every((s) => s.syncStatus === 'synced');

  if (allPhotosSynced && allSurveysSynced) {
    await clearPhotos(visitId);
    await clearSurveys(visitId);
  }
}
