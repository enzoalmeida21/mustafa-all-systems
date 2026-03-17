import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface VisitSummary {
  visitId: string;
  promoterId: string;
  promoterName: string;
  storeId: string;
  storeName: string;
  date: string;
  status: string;
  region: string;
  checkinAt: string | null;
  checkoutAt: string | null;
  totalPhotos: number;
  totalPriceSurveys: number;
  hasPendingSync: boolean;
  hoursWorked: number | null;
}

export interface VisitPhoto {
  id: string;
  visitId: string;
  industryId: string | null;
  industryName: string | null;
  url: string;
  type: string;
  createdAt: string;
}

export interface VisitPriceSurvey {
  id: string;
  visitId: string;
  industryId: string | null;
  productName: string;
  price: number;
  competitorPrices: Array<{ competitorName: string; price: number }>;
  createdAt: string;
}

export interface VisitFilters {
  promoterId?: string;
  storeId?: string;
  industryId?: string;
  month?: string; // MM/YYYY
  startDate?: string;
  endDate?: string;
  region?: string;
  status?: string;
}

export interface PromoterDailyStat {
  promoterId: string;
  promoterName: string;
  date: string;
  totalPhotos: number;
  totalVisits: number;
  totalPriceSurveys: number;
  status: 'conforme' | 'atencao' | 'fora_meta';
}

export interface CompanyOverview {
  totalPromoters: number;
  activePromoters: number;
  totalPhotos: number;
  totalPriceSurveys: number;
  regionRanking: Array<{
    region: string;
    photoCount: number;
    activePromoters: number;
    priceSurveyCount: number;
  }>;
}

export const visitDataService = {
  // ── Supervisor endpoints ──

  async getVisits(filters: VisitFilters, page = 1, limit = 50): Promise<{ visits: VisitSummary[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.promoterId) params.append('promoterId', filters.promoterId);
    if (filters.storeId) params.append('storeId', filters.storeId);
    if (filters.industryId) params.append('industryId', filters.industryId);
    if (filters.month) params.append('month', filters.month);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.region) params.append('region', filters.region);
    if (filters.status) params.append('status', filters.status);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    const response = await apiClient.get(`/supervisors/visits?${params.toString()}`);
    return response.data;
  },

  async getVisitPhotos(visitId: string): Promise<VisitPhoto[]> {
    const response = await apiClient.get(`/supervisors/visits/${visitId}/photos`);
    return response.data.photos || [];
  },

  async getVisitPriceSurveys(visitId: string): Promise<VisitPriceSurvey[]> {
    const response = await apiClient.get(`/supervisors/visits/${visitId}/price-surveys`);
    return response.data.surveys || [];
  },

  async getPromotersDailyStats(date?: string): Promise<PromoterDailyStat[]> {
    const params = date ? `?date=${date}` : '';
    const response = await apiClient.get(`/supervisors/promoters/daily-stats${params}`);
    return response.data.stats || [];
  },

  async getLowPhotoPromoters(date?: string, threshold = 7): Promise<PromoterDailyStat[]> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    params.append('threshold', threshold.toString());
    const response = await apiClient.get(`/supervisors/promoters/low-photos?${params.toString()}`);
    return response.data.promoters || [];
  },

  async getCompanyOverview(startDate?: string, endDate?: string): Promise<CompanyOverview> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await apiClient.get(`/supervisors/company-overview?${params.toString()}`);
    return response.data;
  },

  // ── Industry Owner endpoints ──

  async getIndustryVisits(
    industryId: string,
    filters: Omit<VisitFilters, 'industryId'>,
    page = 1,
    limit = 50
  ): Promise<{ visits: VisitSummary[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.storeId) params.append('storeId', filters.storeId);
    if (filters.month) params.append('month', filters.month);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    const response = await apiClient.get(`/industry-owner/${industryId}/visits?${params.toString()}`);
    return response.data;
  },

  async getIndustryPhotos(
    industryId: string,
    filters: { storeId?: string; month?: string; startDate?: string; endDate?: string },
    page = 1,
    limit = 50
  ): Promise<{ photos: VisitPhoto[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.storeId) params.append('storeId', filters.storeId);
    if (filters.month) params.append('month', filters.month);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    const response = await apiClient.get(`/industry-owner/${industryId}/photos?${params.toString()}`);
    return response.data;
  },

  async getIndustryPriceSurveys(
    industryId: string,
    filters: { storeId?: string; month?: string; startDate?: string; endDate?: string },
    page = 1,
    limit = 50
  ): Promise<{ surveys: VisitPriceSurvey[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.storeId) params.append('storeId', filters.storeId);
    if (filters.month) params.append('month', filters.month);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    const response = await apiClient.get(`/industry-owner/${industryId}/price-surveys?${params.toString()}`);
    return response.data;
  },
};
