import { apiClient } from "./client";

export const doctorApi = {
  getProfile: () => apiClient.get("/doctors/me/profile"),
  updateProfile: (data: Record<string, unknown>) =>
    apiClient.patch("/doctors/me/profile", data),
  updateAvatar: (dataUrl: string) =>
    apiClient.patch("/doctors/me/avatar", { dataUrl }),
  updateBanner: (dataUrl: string) =>
    apiClient.patch("/doctors/me/banner", { dataUrl }),
  upsertSchedule: (schedules: unknown[]) =>
    apiClient.patch("/doctors/me/schedule", { schedules }),
  getAppointments: (status?: string) =>
    apiClient.get("/appointments/doctor/mine", { params: { status } }),
  getAppointment: (id: string) => apiClient.get(`/appointments/${id}`),
  updateAppointmentStatus: (id: string, status: string) =>
    apiClient.patch(`/appointments/${id}/status`, { status }),
  cancelAppointment: (id: string, reason: string) =>
    apiClient.patch(`/appointments/${id}/cancel`, { reason }),
  getWallet: () => apiClient.get("/payments/doctor/wallet"),
  getEarningsStats: () => apiClient.get("/payments/doctor/wallet/stats"),
  getPracticeAnalytics: () => apiClient.get("/analytics/doctor"),
  getSatisfactionSummary: () => apiClient.get("/satisfaction/doctor/summary"),
  getTriageSummary: (appointmentId: string) =>
    apiClient.get(`/triage/appointments/${appointmentId}`),
  sendTriageFeedback: (appointmentId: string, accurate: boolean) =>
    apiClient.post(`/triage/appointments/${appointmentId}/feedback`, {
      accurate,
    }),
  getCareCohort: () => apiClient.get("/care-programs/doctor/cohort"),
  getCareAlerts: () => apiClient.get("/care-programs/doctor/alerts"),
  ackCareAlert: (id: string) =>
    apiClient.post(`/care-programs/alerts/${id}/ack`),
  getCareEnrollment: (id: string) =>
    apiClient.get(`/care-programs/enrollments/${id}`),
  createCareGoal: (
    enrollmentId: string,
    data: {
      type: string;
      direction: "AT_OR_BELOW" | "AT_OR_ABOVE";
      targetValue: number;
      targetValue2?: number;
      title?: string;
      dueDate?: string;
    },
  ) => apiClient.post(`/care-programs/enrollments/${enrollmentId}/goals`, data),
  cancelCareGoal: (goalId: string) =>
    apiClient.post(`/care-programs/goals/${goalId}/cancel`),
  updateCareThresholds: (
    enrollmentId: string,
    thresholds: Record<string, Record<string, number>>,
  ) =>
    apiClient.patch(`/care-programs/enrollments/${enrollmentId}/thresholds`, {
      thresholds,
    }),
  requestWithdrawal: (data: {
    amount: number;
    withdrawMethodId?: string;
    bankDetails?: {
      accountNumber?: string;
      bankCode?: string;
      bankName?: string;
      accountName?: string;
    };
  }) => apiClient.post("/payments/doctor/withdraw", data),
  getWithdrawRequests: () =>
    apiClient.get("/payments/doctor/withdraw-requests"),
  getWithdrawMethods: () => apiClient.get("/payments/doctor/withdraw-methods"),
  saveWithdrawMethod: (data: Record<string, unknown>) =>
    apiClient.post("/payments/doctor/withdraw-methods", data),
  getBanks: () => apiClient.get("/payments/banks"),
  resolveAccount: (accountNumber: string, bankCode: string) =>
    apiClient.get(
      `/payments/resolve-account?accountNumber=${accountNumber}&bankCode=${bankCode}`,
    ),
  getVideos: () => apiClient.get("/videos?mine=true"),
  uploadVideo: (data: Record<string, unknown>) =>
    apiClient.post("/videos", data),
  deleteVideo: (id: string) => apiClient.delete(`/videos/${id}`),
  getNotifications: () => apiClient.get("/notifications/doctor"),
  getChatTopics: () => apiClient.get("/chat/topics"),
  getChatMessages: (topicId: string) =>
    apiClient.get(`/chat/topics/${topicId}/messages`),
  updateSignature: (signatureImage: string) =>
    apiClient.patch("/doctors/me/signature", { signatureImage }),
  updatePricing: (data: {
    scheduledFee?: number;
    instantDayFee?: number;
    instantNightFee?: number;
    discountActive?: boolean;
    discountPercent?: number;
    discountLabel?: string;
    discountEndsAt?: string | null;
  }) => apiClient.patch("/doctors/me/pricing", data),
  getRegions: () => apiClient.get("/regions"),
  updateRegion: (data: { nationality?: string; practiceCountry?: string }) =>
    apiClient.patch("/doctors/me/region", data),
  // Prescriptions
  createPrescription: (data: Record<string, unknown>) =>
    apiClient.post("/prescriptions", data),
  getPrescriptions: () => apiClient.get("/prescriptions/doctor/mine"),
  getPrescription: (id: string) => apiClient.get(`/prescriptions/${id}`),
  // Refill requests
  getRefillRequests: () => apiClient.get("/refills/doctor/pending"),
  getRefillCount: () => apiClient.get("/refills/doctor/count"),
  decideRefill: (
    id: string,
    decision: "APPROVED" | "DECLINED",
    doctorNote?: string,
  ) => apiClient.patch(`/refills/${id}/decision`, { decision, doctorNote }),
  // KYC / verification
  getMyKyc: () => apiClient.get("/kyc/me"),
  uploadKycDoc: (data: {
    type: string;
    dataUrl: string;
    fileName?: string;
    mimeType?: string;
    expiresAt?: string;
  }) => apiClient.post("/kyc/documents", data),
  submitKyc: () => apiClient.post("/kyc/submit", {}),
  // DoctiumPlus (doctor memberships)
  getSubPlans: () => apiClient.get("/subscriptions/doctor/plans"),
  getMySub: () => apiClient.get("/subscriptions/doctor/me"),
  subscribeDoctor: (
    planId: string,
    paymentSource: "CARD" | "WALLET" = "CARD",
  ) =>
    apiClient.post("/subscriptions/doctor/subscribe", {
      planId,
      paymentSource,
    }),
  cancelSub: () => apiClient.patch("/subscriptions/doctor/me/cancel", {}),
  // EMR — appointment-gated patient records
  getPatientRecord: (userId: string, subPatientId?: string) =>
    apiClient.get(`/emr/patient/${userId}`, {
      params: subPatientId ? { subPatientId } : {},
    }),
  addPatientCondition: (userId: string, data: Record<string, unknown>) =>
    apiClient.post(`/emr/patient/${userId}/conditions`, data),
  addPatientAllergy: (userId: string, data: Record<string, unknown>) =>
    apiClient.post(`/emr/patient/${userId}/allergies`, data),
  addPatientFile: (userId: string, data: Record<string, unknown>) =>
    apiClient.post(`/emr/patient/${userId}/files`, data),
  getClinicalNote: (appointmentId: string) =>
    apiClient.get(`/emr/notes/appointment/${appointmentId}`),
  saveClinicalNote: (data: Record<string, unknown>) =>
    apiClient.post(`/emr/notes`, data),
  // Scribe — AI-draft a SOAP note from the consult chat or a voice dictation.
  // Transcription + drafting can outlive the default 30s timeout.
  draftClinicalNote: (
    appointmentId: string,
    data: {
      source: "chat" | "dictation" | "recording";
      audio?: string;
      mimeType?: string;
    },
  ) =>
    apiClient.post(`/emr/notes/${appointmentId}/draft`, data, {
      timeout: 90000,
    }),
  suggestCareProgram: (appointmentId: string, programId: string) =>
    apiClient.post(`/emr/notes/${appointmentId}/suggest-program`, {
      programId,
    }),
  // Pre-visit brief (SCD Phase 4): genotype, live risk, crisis picture
  getCareBrief: (appointmentId: string) =>
    apiClient.get(`/care-programs/brief/${appointmentId}`),
  // Titration (SCD Phase 5): dose log + CBC monitoring
  getCareTitration: (enrollmentId: string) =>
    apiClient.get(`/care-programs/enrollments/${enrollmentId}/titration`),
  setCareDose: (
    enrollmentId: string,
    data: { doseMgPerDay: number; weightKg?: number; note?: string },
  ) => apiClient.post(`/care-programs/enrollments/${enrollmentId}/doses`, data),
  recordCareLab: (enrollmentId: string, data: Record<string, unknown>) =>
    apiClient.post(`/care-programs/enrollments/${enrollmentId}/labs`, data),
  // Follow-ups — doctor recall ("come back in N days")
  scheduleFollowUp: (appointmentId: string, inDays: number, note?: string) =>
    apiClient.post(`/follow-ups`, { appointmentId, inDays, note }),
  // Referrals — doctor → specialist
  listSpecialists: (specialty?: string) =>
    apiClient.get("/referrals/specialists", {
      params: specialty ? { specialty } : {},
    }),
  createReferral: (data: Record<string, unknown>) =>
    apiClient.post("/referrals", data),
  getSentReferrals: () => apiClient.get("/referrals/sent"),
  getReferralStats: () => apiClient.get("/referrals/sent/stats"),
  getReceivedReferrals: () => apiClient.get("/referrals/received"),
  getReferral: (id: string) => apiClient.get(`/referrals/${id}`),
  respondReferral: (
    id: string,
    accept: boolean,
    opts?: { reason?: string; commissionPct?: number },
  ) =>
    apiClient.patch(`/referrals/${id}/respond`, {
      accept,
      reason: opts?.reason,
      commissionPct: opts?.commissionPct,
    }),
};
