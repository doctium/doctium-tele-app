import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class RespondSurveyDto {
  @IsInt()
  @Min(0)
  @Max(10)
  npsScore!: number;

  /** { communication, waitTime, diagnosisClarity, careQuality } each 1–5. Keys validated in the service. */
  @IsOptional()
  @IsObject()
  categories?: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  wouldBookAgain?: boolean;
}
