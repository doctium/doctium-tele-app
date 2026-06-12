import { apiClient } from './client';

export const prescriptionsApi = {
  getMine: () => apiClient.get('/prescriptions/mine'),
  getOne: (id: string) => apiClient.get(`/prescriptions/${id}`),
  requestRefill: (prescriptionId: string, patientNote?: string) =>
    apiClient.post('/refills', { prescriptionId, patientNote }),
  getRefillRequests: (prescriptionId: string) =>
    apiClient.get(`/refills/prescription/${prescriptionId}`),
};
