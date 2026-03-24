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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: 'PROMOTER' | 'SUPERVISOR' | 'ADMIN' | 'INDUSTRY_OWNER';
  state?: string | null;
  createdAt: string;
  updatedAt: string;
  supervisorRegions?: { state: string }[];
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: 'PROMOTER' | 'SUPERVISOR' | 'ADMIN' | 'INDUSTRY_OWNER';
  phone?: string;
  state?: string;
}

export interface UpdateUserRequest {
  email?: string;
  name?: string;
  password?: string;
  role?: 'PROMOTER' | 'SUPERVISOR' | 'ADMIN' | 'INDUSTRY_OWNER';
  phone?: string;
  state?: string | null;
}

export interface ListUsersResponse {
  users: User[];
}

export interface GetUserResponse {
  user: User;
}

export const adminService = {
  async listUsers(): Promise<User[]> {
    const response = await apiClient.get<ListUsersResponse>('/admin/users');
    return response.data.users;
  },

  async getUser(id: string): Promise<User> {
    const response = await apiClient.get<GetUserResponse>(`/admin/users/${id}`);
    return response.data.user;
  },

  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await apiClient.post<GetUserResponse>('/admin/users', data);
    return response.data.user;
  },

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const response = await apiClient.put<GetUserResponse>(`/admin/users/${id}`, data);
    return response.data.user;
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/admin/users/${id}`);
  },

  async getSupervisorRegions(supervisorId: string): Promise<string[]> {
    const response = await apiClient.get(`/admin/supervisors/${supervisorId}/regions`);
    return response.data.states;
  },

  async setSupervisorRegions(supervisorId: string, states: string[]): Promise<string[]> {
    const response = await apiClient.post(`/admin/supervisors/${supervisorId}/regions`, { states });
    return response.data.states;
  },

  async getPromoterSupervisors(promoterId: string): Promise<{ id: string; name: string; email: string }[]> {
    const response = await apiClient.get(`/admin/promoters/${promoterId}/supervisors`);
    return response.data.supervisors;
  },

  async setPromoterSupervisors(promoterId: string, supervisorIds: string[]): Promise<void> {
    await apiClient.post(`/admin/promoters/${promoterId}/supervisors`, { supervisorIds });
  },

  async getPromoterIndustryAssignments(promoterId: string): Promise<{ id: string; industry: { id: string; name: string; code: string }; storeId: string | null }[]> {
    const response = await apiClient.get(`/industry-assignments/promoter/${promoterId}`);
    return response.data.assignments || [];
  },

  async setPromoterStoreIndustries(promoterId: string, storeId: string, industryIds: string[]): Promise<{ industries: { id: string; name: string; code: string }[] }> {
    const response = await apiClient.put(`/industry-assignments/promoter/${promoterId}/store/${storeId}`, {
      industryIds,
    });
    return response.data;
  },

  async createPromoterStoreRedoGrant(promoterId: string, storeId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/admin/promoters/${promoterId}/stores/${storeId}/redo-grant`);
    return response.data;
  },
};

