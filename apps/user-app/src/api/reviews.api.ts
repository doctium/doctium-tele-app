import { apiClient } from './client';

export const reviewsApi = {
  create: (data: { doctorId: string; appointmentId: string; review: string; rating: number }) =>
    apiClient.post('/reviews', data),
  getDoctorReviews: (doctorId: string) => apiClient.get(`/reviews/doctor/${doctorId}`),
};
