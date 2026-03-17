export type VisitStatus =
  | 'idle'
  | 'visitInProgress'
  | 'checkedIn'
  | 'working'
  | 'storeCompleted'
  | 'checkedOut';

export type SyncStatus = 'pending' | 'uploading' | 'synced' | 'error';

export interface LocalVisit {
  visitId: string;
  promoterId: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  date: string; // YYYY-MM-DD
  status: VisitStatus;
  checkinAt: string | null;
  checkoutAt: string | null;
  checkinLatitude: number | null;
  checkinLongitude: number | null;
  checkoutLatitude: number | null;
  checkoutLongitude: number | null;
  hasPendingSync: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalPhoto {
  localId: string;
  visitId: string;
  industryId: string | null;
  uri: string;
  hash: string | null;
  type: 'FACADE_CHECKIN' | 'FACADE_CHECKOUT' | 'OTHER';
  syncStatus: SyncStatus;
  remoteUrl: string | null;
  storagePath: string | null;
  latitude: number | null;
  longitude: number | null;
  deviceCreatedAt: string;
  syncedAt: string | null;
  errorMessage: string | null;
}

export interface LocalPriceSurvey {
  localId: string;
  visitId: string;
  storeId: string;
  industryId: string | null;
  productName: string;
  price: number;
  competitorPrices: Array<{ competitorName: string; price: number }>;
  syncStatus: SyncStatus;
  syncedAt: string | null;
  deviceCreatedAt: string;
  errorMessage: string | null;
}

const VALID_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  idle: ['visitInProgress'],
  visitInProgress: ['checkedIn'],
  checkedIn: ['working'],
  working: ['storeCompleted'],
  storeCompleted: ['checkedOut'],
  checkedOut: ['idle'],
};

export function canTransition(from: VisitStatus, to: VisitStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function generateVisitKey(promoterId: string, storeId: string, date: string): string {
  return `${promoterId}_${storeId}_${date}`;
}
