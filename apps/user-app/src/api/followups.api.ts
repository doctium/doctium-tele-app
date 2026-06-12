import { apiClient } from "./client";

export const followupsApi = {
  getMine: () => apiClient.get("/follow-ups/mine"),
  cancel: (id: string) => apiClient.patch(`/follow-ups/${id}/cancel`),
};
