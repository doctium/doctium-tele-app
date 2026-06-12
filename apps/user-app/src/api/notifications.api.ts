import { apiClient } from './client';
export const notificationsApi = { getAll: () => apiClient.get('/notifications') };
