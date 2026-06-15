export interface UploadKycDocDto {
  type: string; // KycDocumentType
  dataUrl: string; // base64 data-URL (image or PDF)
  fileName?: string;
  mimeType?: string;
  expiresAt?: string; // for MEDICAL_LICENSE
}

export interface VerifyDoctorDto {
  licenseExpiry?: string; // ISO date (MDCN annual licence → Dec 31 of the licence year)
  mdcnFolioNumber?: string;
  licenseNumber?: string;
  notes?: string;
}

export interface ReviewDocDto {
  status: "APPROVED" | "REJECTED";
  reason?: string;
}

export interface CreateDoctorDto {
  firstName?: string;
  lastName?: string;
  name?: string; // legacy single-name fallback; derived if first/last given
  email: string;
  mobile: string;
  password?: string; // optional; a temp password is generated if omitted
  designation?: string;
  type?: string; // DoctorType
  verify?: boolean; // if true, create already-VERIFIED (admin vouches)
}
