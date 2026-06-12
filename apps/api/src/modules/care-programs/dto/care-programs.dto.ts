import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class EnrollDto {
  /** Optional explicit care lead; defaults to the patient's most recent doctor. */
  @IsOptional()
  @IsString()
  doctorId?: string;

  /** Enroll a family member instead of the account holder. */
  @IsOptional()
  @IsString()
  subPatientId?: string;

  /** SCD Phase 3: genotype (AA/AS/AC/SS/SC) — captured when the program has genotype protocols; backfills the health profile. */
  @IsOptional()
  @IsString()
  @MaxLength(4)
  genotype?: string;
}

export class LogCrisisDto {
  /** Pain at its worst, 0–10. */
  @IsInt()
  @Min(0)
  @Max(10)
  painScore!: number;

  /** Body sites — sanitized to short strings in the service. */
  @IsOptional()
  sites?: unknown[];

  /** Suspected triggers — sanitized to short strings in the service. */
  @IsOptional()
  triggers?: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  treatment?: string;

  @IsOptional()
  @IsBoolean()
  hospitalized?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  /** Set when logging a crisis that's already over. */
  @IsOptional()
  @IsISO8601()
  resolvedAt?: string;
}

export class ResolveCrisisDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  treatment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

// ── Titration (SCD Phase 5) ──

export class RecordLabDto {
  /** Haemoglobin, g/dL. Bounds enforced in the service. */
  @IsOptional()
  @IsNumber()
  hb?: number;

  /** White cells, ×10⁹/L. */
  @IsOptional()
  @IsNumber()
  wbc?: number;

  /** Absolute neutrophil count, ×10⁹/L — the hold-dose signal. */
  @IsOptional()
  @IsNumber()
  anc?: number;

  /** Platelets, ×10⁹/L. */
  @IsOptional()
  @IsNumber()
  platelets?: number;

  /** Mean cell volume, fL. */
  @IsOptional()
  @IsNumber()
  mcv?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsISO8601()
  takenAt?: string;
}

export class SetDoseDto {
  /** Total daily hydroxyurea dose in mg. */
  @IsInt()
  @Min(50)
  @Max(3000)
  doseMgPerDay!: number;

  /** Enables mg/kg and maximum-tolerated-dose math. */
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(300)
  weightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  /** Allows back-dating when transcribing an existing regimen. */
  @IsOptional()
  @IsISO8601()
  startedAt?: string;
}

export class LogReadingDto {
  /** VitalType key — validated against the catalog in the service. */
  @IsString()
  type!: string;

  @IsNumber()
  value!: number;

  /** Diastolic, for BLOOD_PRESSURE. */
  @IsOptional()
  @IsNumber()
  value2?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsISO8601()
  takenAt?: string;
}

export class CreateGoalDto {
  /** VitalType key — must be tracked by the program. */
  @IsString()
  type!: string;

  /** AT_OR_BELOW (BP, glucose, weight, pain) or AT_OR_ABOVE (SpO₂, mood, peak flow). */
  @IsString()
  direction!: "AT_OR_BELOW" | "AT_OR_ABOVE";

  @IsNumber()
  targetValue!: number;

  /** Diastolic target, for BLOOD_PRESSURE. */
  @IsOptional()
  @IsNumber()
  targetValue2?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}

export class UpdateThresholdsDto {
  /** { BLOOD_PRESSURE: { max: 135, max2: 85 }, … } — keys sanitized in the service. */
  @IsObject()
  thresholds!: Record<string, Record<string, number>>;
}

export class CreateProgramDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  /** [{ type, cadencePerWeek, min, max, criticalMin, criticalMax, … }] */
  @IsOptional()
  vitals?: unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  checkInDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number; // kobo

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

// ── Enterprise (Phase 3) ──

export class CreateOrganizationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: "ACTIVE" | "SUSPENDED";
}

export class AddOrgMemberDto {
  /** Patient email or mobile. */
  @IsString()
  identifier!: string;

  /** Staff ID / HMO enrollee number. */
  @IsOptional()
  @IsString()
  externalRef?: string;
}

export class UpsertSponsorshipDto {
  @IsString()
  programId!: string;

  @IsInt()
  @Min(1)
  seats!: number;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  vitals?: unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  checkInDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
