import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { DoctorType } from "@doctium/database";

export class RegisterUserDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiProperty() @IsString() mobile: string;
  @ApiPropertyOptional()
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;
  @ApiPropertyOptional()
  @IsEnum(["male", "female", "other"])
  @IsOptional()
  gender?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() dob?: string;
  /** Another user's referral code (from a share link) — NOT this user's own code. */
  @ApiPropertyOptional() @IsString() @IsOptional() referralCode?: string;
}

export class RegisterDoctorDto extends RegisterUserDto {
  @ApiPropertyOptional() @IsString() @IsOptional() designation?: string;
  @ApiPropertyOptional({ enum: DoctorType })
  @IsEnum(DoctorType)
  @IsOptional()
  type?: DoctorType;
}

// ── Doctor self-signup (with email + phone OTP verification) ──
export class DoctorSignupOtpDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() phone: string;
}

export class DoctorSignupDto {
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() phone: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiProperty() @IsString() speciality: string; // General Practitioner | Senior Registrar | Consultant
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  consultantSpeciality?: string;
  /** Language codes the doctor speaks (en | pcm | ha | yo | ig | …). */
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];
  @ApiProperty() @IsString() emailCode: string;
  @ApiProperty() @IsString() phoneCode: string;
}
