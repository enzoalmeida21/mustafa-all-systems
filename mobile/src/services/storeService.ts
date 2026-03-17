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

export interface Store {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface GetStoresResponse {
  stores: Store[];
  hasRoute?: boolean;
  completedStoreIdsToday?: string[];
}

export const storeService = {
  async getStores(): Promise<GetStoresResponse> {
    try {
      const response = await apiClient.get<GetStoresResponse>('/promoters/stores');
      return {
        stores: response.data.stores || [],
        hasRoute: response.data.hasRoute,
        completedStoreIdsToday: response.data.completedStoreIdsToday || [],
      };
    } catch (error) {
      console.error('Erro ao buscar lojas:', error);
      return { stores: [], completedStoreIdsToday: [] };
    }
  },
};


