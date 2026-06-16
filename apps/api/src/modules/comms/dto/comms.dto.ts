import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { type EmailAttachment } from "../../notifications/channels/mailer.provider";

export class SendPushDto {
  @ApiProperty({ enum: ["PATIENTS", "DOCTORS", "ALL"] })
  @IsString()
  @IsIn(["PATIENTS", "DOCTORS", "ALL"])
  audience!: string;

  @ApiProperty() @IsString() @IsNotEmpty() title!: string;

  @ApiProperty() @IsString() @IsNotEmpty() body!: string;

  @ApiPropertyOptional({
    description: "base64 data-URL — uploaded to Cloudinary",
  })
  @IsOptional()
  @IsString()
  imageDataUrl?: string;

  @ApiPropertyOptional({
    description: "direct image URL (used if no imageDataUrl)",
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class SendEmailDto {
  @ApiProperty({ enum: ["AUDIENCE", "RECIPIENTS"] })
  @IsString()
  @IsIn(["AUDIENCE", "RECIPIENTS"])
  mode!: string;

  @ApiPropertyOptional({ enum: ["PATIENTS", "DOCTORS", "ALL"] })
  @IsOptional()
  @IsString()
  @IsIn(["PATIENTS", "DOCTORS", "ALL"])
  audience?: string;

  @ApiPropertyOptional({ enum: ["USER", "DOCTOR"] })
  @IsOptional()
  @IsString()
  @IsIn(["USER", "DOCTOR"])
  recipientType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientIds?: string[];

  @ApiProperty() @IsString() @IsNotEmpty() subject!: string;

  @ApiProperty() @IsString() @IsNotEmpty() body!: string;

  // Optional file attachments (base64 content). Trusted admin endpoint.
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  attachments?: EmailAttachment[];
}

export class SendSmsDto {
  @ApiProperty({ enum: ["AUDIENCE", "RECIPIENTS"] })
  @IsString()
  @IsIn(["AUDIENCE", "RECIPIENTS"])
  mode!: string;

  @ApiPropertyOptional({ enum: ["PATIENTS", "DOCTORS", "ALL"] })
  @IsOptional()
  @IsString()
  @IsIn(["PATIENTS", "DOCTORS", "ALL"])
  audience?: string;

  @ApiPropertyOptional({ enum: ["USER", "DOCTOR"] })
  @IsOptional()
  @IsString()
  @IsIn(["USER", "DOCTOR"])
  recipientType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientIds?: string[];

  @ApiProperty() @IsString() @IsNotEmpty() message!: string;
}
