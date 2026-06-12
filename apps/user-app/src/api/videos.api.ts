import { apiClient } from "./client";

export const videosApi = {
  getAll: (search?: string) => apiClient.get("/videos", { params: { search } }),
  getOne: (id: string) => apiClient.get(`/videos/${id}`),
  toggleLike: (id: string) => apiClient.post(`/videos/${id}/like`),
  addComment: (id: string, comment: string) =>
    apiClient.post(`/videos/${id}/comment`, { comment }),
  share: (id: string) => apiClient.post(`/videos/${id}/share`),
  report: (id: string, reason: string, note?: string) =>
    apiClient.post(`/videos/${id}/report`, { reason, note }),
};
