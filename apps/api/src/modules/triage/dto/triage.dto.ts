import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class StartTriageDto {
  /** Symptom check on behalf of a family member. */
  @IsOptional()
  @IsString()
  subPatientId?: string;

  /** TRIAGE (default) or QA — validated in the service. */
  @IsOptional()
  @IsString()
  mode?: string;

  /** auto (default) | en | pcm | ha | yo | ig — validated in the service. */
  @IsOptional()
  @IsString()
  language?: string;
}

export class TriageMessageDto {
  @IsString()
  @MaxLength(1000)
  text!: string;
}

export class TriageSpeakDto {
  /** Index of the assistant message (in session.messages) to read aloud. */
  @IsInt()
  @Min(0)
  messageIndex!: number;
}

export class TriageVoiceDto {
  /** Base64 audio or a full data-URL (m4a/mp3/wav/webm), ≤ ~5MB decoded. */
  @IsString()
  @MaxLength(8_000_000)
  audio!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class TriageFeedbackDto {
  /** Was Leenah's routing (specialty/urgency) right for this consult? */
  @IsBoolean()
  accurate!: boolean;
}

export class TriageDispositionDto {
  /** INSTANT_CONSULT | BOOKED | DISMISSED — validated in the service. */
  @IsString()
  action!: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;
}
