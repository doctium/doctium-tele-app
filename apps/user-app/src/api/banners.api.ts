import { apiClient } from "./client";

export type Banner = {
  id: string;
  title: string;
  image: string;
  type: "EXTERNAL" | "APP";
  target: string;
};

export const bannersApi = {
  // apiClient unwraps the { data } envelope, so this resolves to the array.
  getActive: () => apiClient.get("/banners") as Promise<Banner[]>,
  recordClick: (id: string) => apiClient.post(`/banners/${id}/click`),
};
