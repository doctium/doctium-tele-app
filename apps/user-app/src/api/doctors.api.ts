import { apiClient } from "./client";

export const doctorsApi = {
  getAll: (params?: {
    search?: string;
    serviceId?: string;
    type?: string;
    country?: string;
    nationality?: string;
    language?: string;
  }) => apiClient.get("/doctors", { params }),
  getOne: (id: string) => apiClient.get(`/doctors/${id}`),
  getSlots: (id: string, date: string) =>
    apiClient.get(`/doctors/${id}/slots`, { params: { date } }),
};
