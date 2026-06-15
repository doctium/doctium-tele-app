import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";

const TYPES = ["EXTERNAL", "APP"] as const;
type BannerTypeStr = (typeof TYPES)[number];

export class CreateBannerDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ enum: TYPES }) @IsEnum(TYPES) type: BannerTypeStr;
  /** External URL (EXTERNAL) or in-app destination key (APP). */
  @ApiPropertyOptional() @IsString() @IsOptional() target?: string;
  /** PNG/JPG data-URL, or an already-hosted URL. */
  @ApiPropertyOptional() @IsString() @IsOptional() image?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsInt() @IsOptional() sortOrder?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() startsAt?: string; // ISO date
  @ApiPropertyOptional() @IsString() @IsOptional() endsAt?: string; // ISO date
}

export class UpdateBannerDto {
  @ApiPropertyOptional() @IsString() @IsOptional() title?: string;
  @ApiPropertyOptional({ enum: TYPES })
  @IsEnum(TYPES)
  @IsOptional()
  type?: BannerTypeStr;
  @ApiPropertyOptional() @IsString() @IsOptional() target?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() image?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsInt() @IsOptional() sortOrder?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() startsAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() endsAt?: string;
}
