import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/api';

const apiClient = axios.create({
  baseURL: apiConfig.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface Industry {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface IndustryAssignment {
  id: string;
  industry: Industry;
  store?: {
    id: string;
    name: string;
  };
}

export interface CoverageItem {
  industry: Industry;
  covered: boolean;
  photoCount: number;
}

export interface CoverageResponse {
  visitId: string;
  storeId: string;
  storeName: string;
  coverage: CoverageItem[];
  pending: CoverageItem[];
  covered: CoverageItem[];
  isComplete: boolean;
  totalRequired: number;
  totalCovered: number;
  percentComplete: number;
}

export const industryService = {
  /**
   * Buscar indústrias atribuídas ao promotor logado
   */
  async getPromoterIndustries(promoterId?: string): Promise<IndustryAssignment[]> {
    try {
      const endpoint = promoterId 
        ? `/industry-assignments/promoter/${promoterId}`
        : '/industry-assignments/promoter/me';
      const response = await apiClient.get(endpoint);
      return response.data.assignments || [];
    } catch (error) {
      console.error('Error fetching promoter industries:', error);
      throw error;
    }
  },

  /**
   * Buscar indústrias obrigatórias de uma loja específica
   */
  async getStoreIndustries(storeId: string): Promise<Industry[]> {
    try {
      const response = await apiClient.get(`/store-industries/${storeId}?isActive=true`);
      return response.data.industries || [];
    } catch (error) {
      console.error('Error fetching store industries:', error);
      // Retornar array vazio se não houver indústrias configuradas
      return [];
    }
  },

  /**
   * Indústrias da visita: retorna industries + needsOnboarding (true se promotor ainda não escolheu para esta loja).
   */
  async getVisitIndustries(visitId: string): Promise<{
    visitId: string;
    storeId: string;
    needsOnboarding: boolean;
    needsSupervisorAssignment?: boolean;
    industries: Industry[];
  }> {
    const response = await apiClient.get(`/promoters/visits/${visitId}/industries`);
    return response.data;
  },

  /**
   * Definir indústrias que o promotor atende nesta loja (onboarding).
   */
  async setMyStoreIndustries(storeId: string, industryIds: string[]): Promise<{ industries: Industry[] }> {
    const response = await apiClient.post(`/industry-assignments/me/store/${storeId}`, {
      industryIds,
    });
    return response.data;
  },

  /**
   * Verificar cobertura de indústrias em uma visita
   */
  async getVisitCoverage(visitId: string): Promise<CoverageResponse> {
    try {
      const response = await apiClient.get(`/promoters/visits/${visitId}/coverage`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit coverage:', error);
      throw error;
    }
  },

  /**
   * Associar foto a uma indústria
   */
  async associatePhotoToIndustry(data: {
    photoId: string;
    industryId: string;
    visitId: string;
  }): Promise<any> {
    try {
      const response = await apiClient.post('/photo-industries/associate', data);
      return response.data;
    } catch (error) {
      console.error('Error associating photo to industry:', error);
      throw error;
    }
  },
};
