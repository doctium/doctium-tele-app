import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

/**
 * EMR write payloads. These are shared by the patient (`me/*`) and doctor
 * (`patient/:userId/*`) routes, so each DTO covers the union of fields both
 * clients send. Enum-like fields are validated loosely (the service applies
 * defaults); subPatientId scopes a write to a family member.
 */

export class CreateConditionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  onsetDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  subPatientId?: string;
}

export class CreateAllergyDto {
  @IsString()
  substance!: string;

  @IsOptional()
  @IsString()
  reaction?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  subPatientId?: string;
}

export class CreateSurgeryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  performedDate?: string;

  @IsOptional()
  @IsString()
  hospital?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  subPatientId?: string;
}

export class CreateImmunizationDto {
  @IsString()
  vaccine!: string;

  @IsOptional()
  @IsString()
  doseLabel?: string;

  @IsOptional()
  @IsString()
  dateGiven?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  subPatientId?: string;
}

export class UpdateHealthProfileDto {
  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  genotype?: string;

  @IsOptional()
  @IsNumber()
  heightCm?: number | null;

  @IsOptional()
  @IsNumber()
  weightKg?: number | null;

  @IsOptional()
  @IsString()
  subPatientId?: string;
}

export class CreateMedicalFileDto {
  @IsOptional()
  @IsString()
  dataUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  subPatientId?: string;
}

export class UpsertClinicalNoteDto {
  @IsString()
  appointmentId!: string;

  @IsOptional()
  @IsString()
  subjective?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  assessment?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @IsOptional()
  @IsNumber()
  heartRate?: number | null;

  @IsOptional()
  @IsNumber()
  temperature?: number | null;

  @IsOptional()
  @IsNumber()
  respiratoryRate?: number | null;

  @IsOptional()
  @IsNumber()
  oxygenSat?: number | null;

  @IsOptional()
  @IsNumber()
  weightKg?: number | null;

  @IsOptional()
  @IsNumber()
  heightCm?: number | null;
}
