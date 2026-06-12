import { apiClient } from "./client";

export const emrApi = {
  getPatients: () => apiClient.get("/emr/me/patients"),
  getRecord: (subPatientId?: string) =>
    apiClient.get("/emr/me", { params: subPatientId ? { subPatientId } : {} }),
  getFhir: (subPatientId?: string) =>
    apiClient.get("/emr/me/fhir", {
      params: subPatientId ? { subPatientId } : {},
    }),
  updateProfile: (data: Record<string, unknown>) =>
    apiClient.put("/emr/me/profile", data),
  addCondition: (data: Record<string, unknown>) =>
    apiClient.post("/emr/me/conditions", data),
  addAllergy: (data: Record<string, unknown>) =>
    apiClient.post("/emr/me/allergies", data),
  addSurgery: (data: Record<string, unknown>) =>
    apiClient.post("/emr/me/surgeries", data),
  addImmunization: (data: Record<string, unknown>) =>
    apiClient.post("/emr/me/immunizations", data),
  deleteEntry: (
    type: "condition" | "allergy" | "surgery" | "immunization",
    id: string,
  ) => apiClient.delete(`/emr/me/${type}/${id}`),
  addFile: (data: Record<string, unknown>) =>
    apiClient.post("/emr/me/files", data),
  deleteFile: (id: string) => apiClient.delete(`/emr/me/files/${id}`),
};
