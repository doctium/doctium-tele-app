import { apiClient } from './client';

export interface CallToken { token: string; appId: number; userId: string; }
export interface RecordingConsent {
  appointmentId: string;
  status: 'NOT_REQUESTED' | 'PENDING' | 'CONSENTED' | 'DECLINED' | 'REVOKED';
  patientConsented: boolean;
  doctorConsented: boolean;
  bothConsented: boolean;
  requestedByRole?: 'USER' | 'DOCTOR' | 'ADMIN' | null;
  requestedAt?: string | null;
}
export interface RecordingSession {
  appointmentId: string;
  status: 'NOT_STARTED' | 'STARTING' | 'ACTIVE' | 'STOPPING' | 'STOPPED' | 'FAILED';
  provider: string;
  roomId: string;
  taskId?: string | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  outputPrefix?: string | null;
  storageVendor?: string | null;
  lastError?: string | null;
}
export interface RecordingAsset {
  id: string;
  appointmentId: string;
  provider: string;
  storageVendor: string;
  status: 'AVAILABLE' | 'ARCHIVED' | 'QUARANTINED' | 'DELETED';
  fileName: string;
  mimeType: string;
  sizeBytes?: string | null;
  durationSeconds?: number | null;
  encrypted: boolean;
  encryptionMethod: string;
  retentionPolicy?: string;
  retentionDays?: number;
  retainUntil?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}
export interface RecordingAssetAccess {
  asset: RecordingAsset;
  accessUrl: string;
  expiresAt: string;
}
export interface RecordingRequest {
  id: string;
  appointmentId: string;
  assetId?: string | null;
  type: 'EXPORT' | 'DELETE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  reason: string;
  disputeHold: boolean;
  disputeHoldUntil?: string | null;
  disputeHoldReason?: string | null;
  exportUrl?: string | null;
  exportExpiresAt?: string | null;
  createdAt: string;
}

export const callApi = {
  /** Fetches a Zego token for the current user to join a video room. */
  getToken: async (): Promise<CallToken> => {
    const res = await apiClient.post('/call/token');
    return (res as unknown as { data: CallToken }).data;
  },
  getRecordingConsent: async (appointmentId: string): Promise<RecordingConsent> => {
    const res = await apiClient.get(`/appointments/${appointmentId}/recording-consent`);
    return (res as unknown as { data: RecordingConsent }).data;
  },
  requestRecordingConsent: async (appointmentId: string): Promise<RecordingConsent> => {
    const res = await apiClient.post(`/appointments/${appointmentId}/recording-consent/request`);
    return (res as unknown as { data: RecordingConsent }).data;
  },
  respondRecordingConsent: async (
    appointmentId: string,
    consent: boolean,
  ): Promise<RecordingConsent> => {
    const res = await apiClient.patch(`/appointments/${appointmentId}/recording-consent`, { consent });
    return (res as unknown as { data: RecordingConsent }).data;
  },
  getRecording: async (appointmentId: string): Promise<RecordingSession> => {
    const res = await apiClient.get(`/appointments/${appointmentId}/recording`);
    return (res as unknown as { data: RecordingSession }).data;
  },
  startRecording: async (appointmentId: string): Promise<RecordingSession> => {
    const res = await apiClient.post(`/appointments/${appointmentId}/recording/start`);
    return (res as unknown as { data: RecordingSession }).data;
  },
  stopRecording: async (appointmentId: string): Promise<RecordingSession> => {
    const res = await apiClient.post(`/appointments/${appointmentId}/recording/stop`);
    return (res as unknown as { data: RecordingSession }).data;
  },
  listRecordingAssets: async (appointmentId: string): Promise<RecordingAsset[]> => {
    const res = await apiClient.get(`/appointments/${appointmentId}/recording/assets`);
    return (res as unknown as { data: RecordingAsset[] }).data;
  },
  getRecordingAssetAccess: async (
    appointmentId: string,
    assetId: string,
  ): Promise<RecordingAssetAccess> => {
    const res = await apiClient.get(`/appointments/${appointmentId}/recording/assets/${assetId}/access`);
    return (res as unknown as { data: RecordingAssetAccess }).data;
  },
  listRecordingRequests: async (appointmentId: string): Promise<RecordingRequest[]> => {
    const res = await apiClient.get(`/appointments/${appointmentId}/recording/requests`);
    return (res as unknown as { data: RecordingRequest[] }).data;
  },
  createRecordingRequest: async (
    appointmentId: string,
    data: { type: 'EXPORT' | 'DELETE'; assetId?: string; reason?: string },
  ): Promise<RecordingRequest> => {
    const res = await apiClient.post(`/appointments/${appointmentId}/recording/requests`, data);
    return (res as unknown as { data: RecordingRequest }).data;
  },
};
