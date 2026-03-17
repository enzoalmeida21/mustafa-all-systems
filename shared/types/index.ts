// User types
export enum UserRole {
  PROMOTER = 'PROMOTER',
  SUPERVISOR = 'SUPERVISOR',
  INDUSTRY_OWNER = 'INDUSTRY_OWNER',
  ADMIN = 'ADMIN',
}

export type VisitStatusType =
  | 'idle'
  | 'visitInProgress'
  | 'checkedIn'
  | 'working'
  | 'storeCompleted'
  | 'checkedOut';

export type SyncStatusType = 'pending' | 'uploading' | 'synced' | 'error';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Visit types
export interface Visit {
  id: string;
  promoterId: string;
  industryId: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  checkInLatitude: number;
  checkInLongitude: number;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkInPhotoUrl: string;
  checkOutPhotoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Photo types
export enum PhotoType {
  FACADE_CHECKIN = 'FACADE_CHECKIN',
  FACADE_CHECKOUT = 'FACADE_CHECKOUT',
  OTHER = 'OTHER',
}

export interface Photo {
  id: string;
  visitId: string;
  url: string;
  type: PhotoType;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
}

// Price Research types
export interface PriceResearch {
  id: string;
  visitId: string;
  industryId: string;
  productName: string;
  price: number;
  competitorPrices: CompetitorPrice[];
  createdAt: Date;
}

export interface CompetitorPrice {
  competitorName: string;
  price: number;
}

// Industry types
export interface Industry {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  updatedAt: Date;
}

// Location types
export interface Location {
  id: string;
  visitId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

// Photo Quota types
export interface PhotoQuota {
  id: string;
  promoterId: string;
  expectedPhotos: number;
  createdAt: Date;
  updatedAt: Date;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Export types
export interface ExportRequest {
  startDate: string;
  endDate: string;
  promoterIds?: string[];
  industryIds?: string[];
  format: 'pptx' | 'pdf' | 'excel' | 'html';
}

export interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl: string | null;
  createdAt: Date;
}

// ── Firestore Document Models ──
// These types define the canonical shape of documents stored in Firestore.
// Both backend (when syncing) and web (when reading) should use these types.

/**
 * Firestore: promoters/{promoterId}
 */
export interface FirestorePromoterDoc {
  name: string;
  email: string;
  role: UserRole;
  regions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Firestore: stores/{storeId}
 */
export interface FirestoreStoreDoc {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  region: string;
  industryIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Firestore: industries/{industryId}
 */
export interface FirestoreIndustryDoc {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Firestore: visits/{visitId}
 * visitId = promoterId_storeId_YYYY-MM-DD
 */
export interface FirestoreVisitDoc {
  promoterId: string;
  storeId: string;
  storeName: string;
  date: string; // YYYY-MM-DD
  status: VisitStatusType;
  region: string;
  checkinAt: string | null;
  checkoutAt: string | null;
  checkinLatitude: number | null;
  checkinLongitude: number | null;
  checkoutLatitude: number | null;
  checkoutLongitude: number | null;
  checkinPhotoUrl: string | null;
  checkoutPhotoUrl: string | null;
  totalPhotos: number;
  totalPriceSurveys: number;
  hasPendingSync: boolean;
  hoursWorked: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Firestore: visits/{visitId}/photos/{photoId}
 */
export interface FirestorePhotoDoc {
  industryId: string | null;
  storagePath: string;
  downloadUrl: string;
  hash: string | null;
  type: 'FACADE_CHECKIN' | 'FACADE_CHECKOUT' | 'OTHER';
  latitude: number | null;
  longitude: number | null;
  deviceCreatedAt: string;
  createdAt: string;
}

/**
 * Firestore: visits/{visitId}/priceSurveys/{surveyId}
 */
export interface FirestorePriceSurveyDoc {
  industryId: string | null;
  storeId: string;
  productName: string;
  price: number;
  competitorPrices: CompetitorPrice[];
  deviceCreatedAt: string;
  createdAt: string;
}

