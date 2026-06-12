import { apiClient } from './client';

export const appointmentsApi = {
  book: (data: Record<string, unknown>) => apiClient.post('/appointments', data),
  getMine: (status?: string) => apiClient.get('/appointments/mine', { params: { status } }),
  getOne: (id: string) => apiClient.get(`/appointments/${id}`),
  cancel: (id: string, reason: string) => apiClient.patch(`/appointments/${id}/cancel`, { reason }),
  validate_coupon: (code: string, amount: number) =>
    apiClient.post('/coupons/validate', { code, amount }),
  payInit: (appointmentId: string) => apiClient.post(`/payments/appointment/${appointmentId}/init`, {}),
};
