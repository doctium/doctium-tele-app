import { apiClient } from "./client";

export const satisfactionApi = {
  getMine: () => apiClient.get("/satisfaction/mine"),
  respond: (
    id: string,
    data: {
      npsScore: number;
      categories?: Record<string, number>;
      comment?: string;
      wouldBookAgain?: boolean;
    },
  ) => apiClient.post(`/satisfaction/${id}/respond`, data),
};
