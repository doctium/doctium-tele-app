import { apiClient } from "./client";

export const triageApi = {
  getStatus: () => apiClient.get("/triage/status"),
  getMine: () => apiClient.get("/triage/mine"),
  startSession: (opts?: {
    subPatientId?: string;
    mode?: "TRIAGE" | "QA";
    language?: string;
  }) => apiClient.post("/triage/sessions", opts ?? {}),
  sendMessage: (sessionId: string, text: string) =>
    apiClient.post(`/triage/sessions/${sessionId}/messages`, { text }),
  transcribeVoice: (sessionId: string, audio: string, mimeType?: string) =>
    apiClient.post(`/triage/sessions/${sessionId}/voice`, { audio, mimeType }),
  speak: (sessionId: string, messageIndex: number) =>
    apiClient.post(`/triage/sessions/${sessionId}/speak`, { messageIndex }),
  setDisposition: (
    sessionId: string,
    action: "INSTANT_CONSULT" | "BOOKED" | "DISMISSED",
    appointmentId?: string,
  ) =>
    apiClient.post(`/triage/sessions/${sessionId}/disposition`, {
      action,
      appointmentId,
    }),
};
