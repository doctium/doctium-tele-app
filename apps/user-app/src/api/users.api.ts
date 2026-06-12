import { apiClient } from "./client";

export const usersApi = {
  getProfile: () => apiClient.get("/users/profile"),
  updateProfile: (data: Record<string, unknown>) =>
    apiClient.patch("/users/profile", data),
  updateAvatar: (dataUrl: string) =>
    apiClient.patch("/users/profile/avatar", { dataUrl }),
  getFavorites: () => apiClient.get("/users/favorites"),
  getFavoriteIds: () => apiClient.get("/users/favorites/ids"),
  toggleFavorite: (doctorId: string) =>
    apiClient.post(`/users/favorites/${doctorId}/toggle`),
  getHealthInsights: () => apiClient.get("/analytics/patient"),
  getSubPatients: () => apiClient.get("/users/sub-patients"),
  createSubPatient: (data: Record<string, unknown>) =>
    apiClient.post("/users/sub-patients", data),
  deleteSubPatient: (id: string) =>
    apiClient.delete(`/users/sub-patients/${id}`),
};
