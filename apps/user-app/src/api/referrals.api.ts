import { apiClient } from "./client";

export const referralsApi = {
  getMine: () => apiClient.get("/referrals/mine"),
  getOne: (id: string) => apiClient.get(`/referrals/${id}`),
};
