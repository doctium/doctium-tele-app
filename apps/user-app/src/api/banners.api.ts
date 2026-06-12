import { apiClient } from './client';
export const bannersApi = { getActive: () => apiClient.get('/banners') };
