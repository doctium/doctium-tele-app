import { apiClient } from "./client";

export interface SupportMessagePayload {
  type?: "TEXT" | "IMAGE" | "AUDIO";
  body?: string;
  dataUrl?: string;
  fileName?: string;
  durationSec?: number;
}

export const supportApi = {
  getThread: () => apiClient.get("/support/thread"),
  sendMessage: (data: SupportMessagePayload) =>
    apiClient.post("/support/messages", data),
  markRead: () => apiClient.patch("/support/read"),
};
