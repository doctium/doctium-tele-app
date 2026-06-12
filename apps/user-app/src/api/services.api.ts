import { apiClient } from './client';

export const servicesApi = {
  getAll: () => apiClient.get('/services'),
  getDoctorsByService: (serviceId: string) => apiClient.get(`/services/${serviceId}/doctors`),
};
