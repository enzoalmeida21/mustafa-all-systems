import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token
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

// Interceptor para tratar erros 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido ou expirado - limpar e redirecionar para login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const supervisorService = {
  async getDashboard() {
    const response = await apiClient.get('/supervisors/dashboard');
    return response.data;
  },

  async getPromoters() {
    const response = await apiClient.get('/supervisors/promoters');
    return response.data;
  },

  async getPromoterPerformance(promoterId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await apiClient.get(
      `/supervisors/promoters/${promoterId}/performance?${params.toString()}`
    );
    return response.data;
  },

  async getPromoterVisits(promoterId: string, page = 1, limit = 20) {
    const response = await apiClient.get(
      `/supervisors/promoters/${promoterId}/visits?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  async getPromoterRoute(promoterId: string, date?: string) {
    const params = date ? `?date=${date}` : '';
    const response = await apiClient.get(`/supervisors/promoters/${promoterId}/route${params}`);
    return response.data;
  },

  async getMissingPhotos(promoterId?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (promoterId) params.append('promoterId', promoterId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await apiClient.get(`/supervisors/missing-photos?${params.toString()}`);
    return response.data;
  },

  async setPhotoQuota(promoterId: string, expectedPhotos: number) {
    const response = await apiClient.put(`/supervisors/promoters/${promoterId}/photo-quota`, {
      expectedPhotos,
    });
    return response.data;
  },

  async exportReport(data: {
    startDate: string;
    endDate: string;
    promoterIds?: string[];
    storeIds?: string[];
    format: 'pptx' | 'pdf' | 'excel' | 'html';
  }) {
    const response = await apiClient.post('/supervisors/export/report', data);
    return response.data;
  },

  async getExportStatus(jobId: string) {
    const response = await apiClient.get(`/supervisors/export/status/${jobId}`);
    return response.data;
  },

  async downloadExport(jobId: string) {
    const response = await apiClient.get(`/supervisors/export/download/${jobId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Rotas de configuração de rotas
  async setPromoterRoute(promoterId: string, storeIds: string[], orders?: number[], supervisorId?: string | null) {
    const response = await apiClient.post(`/supervisors/promoters/${promoterId}/route-assignment`, {
      storeIds,
      orders,
      supervisorId: supervisorId || null,
    });
    return response.data;
  },

  async addStoresToRoute(promoterId: string, storeIds: string[], supervisorId?: string | null) {
    const response = await apiClient.post(`/supervisors/promoters/${promoterId}/route-assignment/add`, {
      storeIds,
      supervisorId: supervisorId || null,
    });
    return response.data;
  },

  async removeStoreFromRoute(promoterId: string, storeId: string) {
    const response = await apiClient.delete(`/supervisors/promoters/${promoterId}/route-assignment/${storeId}`);
    return response.data;
  },

  async updateRouteAssignmentSupervisor(promoterId: string, storeId: string, supervisorId: string | null) {
    const response = await apiClient.patch(
      `/supervisors/promoters/${promoterId}/route-assignment/${storeId}/supervisor`,
      { supervisorId },
    );
    return response.data;
  },

  async getSupervisorsList(): Promise<{ supervisors: { id: string; name: string; email: string; state: string | null }[] }> {
    const response = await apiClient.get('/supervisors/supervisors-list');
    return response.data;
  },

  async getPromoterRouteAssignment(promoterId: string) {
    const response = await apiClient.get(`/supervisors/promoters/${promoterId}/route-assignment`);
    return response.data;
  },

  async getAllRoutes() {
    const response = await apiClient.get('/supervisors/routes');
    return response.data;
  },

  async getAvailableStores() {
    const response = await apiClient.get('/supervisors/stores/available');
    return response.data;
  },

  // Rotas de gerenciamento de lojas
  async getAllStores() {
    const response = await apiClient.get('/supervisors/stores');
    return response.data;
  },

  async getStore(storeId: string) {
    const response = await apiClient.get(`/supervisors/stores/${storeId}`);
    return response.data;
  },

  async createStore(data: {
    name: string;
    code?: string;
    address: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    industryIds?: string[];
  }) {
    const response = await apiClient.post('/supervisors/stores', data);
    return response.data;
  },

  async bulkCreateStores(stores: {
    name: string;
    code?: string;
    address: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    industryIds?: string[];
  }[]) {
    const response = await apiClient.post('/supervisors/stores/bulk', { stores });
    return response.data;
  },

  async updateStore(storeId: string, data: {
    name?: string;
    code?: string | null;
    address?: string;
    state?: string | null;
    latitude?: number;
    longitude?: number;
  }) {
    const response = await apiClient.put(`/supervisors/stores/${storeId}`, data);
    return response.data;
  },

  async deleteStore(storeId: string) {
    const response = await apiClient.delete(`/supervisors/stores/${storeId}`);
    return response.data;
  },

  // Rotas de indústrias por loja
  async getStoreIndustries(storeId: string) {
    const response = await apiClient.get(`/store-industries/${storeId}?isActive=true`);
    return response.data;
  },

  async getPromoterIndustryAssignments(
    promoterId: string
  ): Promise<{ id: string; industry: { id: string; name: string; code: string }; storeId: string | null }[]> {
    const response = await apiClient.get(`/industry-assignments/promoter/${promoterId}`);
    return response.data.assignments || [];
  },

  async setPromoterStoreIndustries(
    promoterId: string,
    storeId: string,
    industryIds: string[]
  ): Promise<{ industries: { id: string; name: string; code: string }[] }> {
    const response = await apiClient.put(`/industry-assignments/promoter/${promoterId}/store/${storeId}`, {
      industryIds,
    });
    return response.data;
  },

  async updateStoreIndustries(storeId: string, industryIds: string[]) {
    const response = await apiClient.put(`/store-industries/${storeId}`, {
      industryIds,
    });
    return response.data;
  },

  async getAllStoreIndustries() {
    const response = await apiClient.get('/store-industries');
    return response.data;
  },

  // Rotas de pendências de indústrias
  async getPendingIndustries(view: 'store' | 'promoter' = 'store', date?: string) {
    const params = new URLSearchParams();
    params.append('view', view);
    if (date) params.append('date', date);
    const response = await apiClient.get(`/supervisors/pending-industries?${params.toString()}`);
    return response.data;
  },

  async getMyStates(): Promise<{ states: string[] }> {
    const response = await apiClient.get('/supervisors/my-states');
    return response.data;
  },

  async getPendingOverview(state?: string) {
    const params = state ? `?state=${state}` : '';
    const response = await apiClient.get(`/supervisors/pending-overview${params}`);
    return response.data;
  },
};

