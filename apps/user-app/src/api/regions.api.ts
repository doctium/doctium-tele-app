import { apiClient } from './client';

export const regionsApi = {
  getAll: () => apiClient.get('/regions'),
  getAvailable: () => apiClient.get('/regions/available'),
};
