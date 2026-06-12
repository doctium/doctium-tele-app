import { apiClient } from "./client";

export const careApi = {
  getCatalog: () => apiClient.get("/care-programs"),
  getMine: () => apiClient.get("/care-programs/mine"),
  enroll: (
    programId: string,
    opts?: { doctorId?: string; subPatientId?: string; genotype?: string },
  ) => apiClient.post(`/care-programs/${programId}/enroll`, opts ?? {}),
  getEnrollment: (id: string) =>
    apiClient.get(`/care-programs/enrollments/${id}`),
  logReading: (
    enrollmentId: string,
    data: { type: string; value: number; value2?: number; note?: string },
  ) =>
    apiClient.post(`/care-programs/enrollments/${enrollmentId}/readings`, data),
  withdraw: (enrollmentId: string) =>
    apiClient.post(`/care-programs/enrollments/${enrollmentId}/withdraw`),
  // Crisis diary (SCD Phase 3)
  logCrisis: (
    enrollmentId: string,
    data: {
      painScore: number;
      sites?: string[];
      triggers?: string[];
      treatment?: string;
      hospitalized?: boolean;
      notes?: string;
      resolvedAt?: string;
    },
  ) =>
    apiClient.post(`/care-programs/enrollments/${enrollmentId}/crises`, data),
  resolveCrisis: (
    crisisId: string,
    data?: { treatment?: string; notes?: string },
  ) => apiClient.post(`/care-programs/crises/${crisisId}/resolve`, data ?? {}),
  // Titration (SCD Phase 5)
  getTitration: (enrollmentId: string) =>
    apiClient.get(`/care-programs/enrollments/${enrollmentId}/titration`),
  recordLab: (enrollmentId: string, data: Record<string, unknown>) =>
    apiClient.post(`/care-programs/enrollments/${enrollmentId}/labs`, data),
};
