import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class SendSupportMessageDto {
  @ApiPropertyOptional({ enum: ["TEXT", "IMAGE", "AUDIO"] })
  @IsOptional()
  @IsString()
  @IsIn(["TEXT", "IMAGE", "AUDIO"])
  type?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;

  @ApiPropertyOptional({ description: "base64 data-URL for IMAGE/AUDIO" })
  @IsOptional()
  @IsString()
  dataUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() fileName?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) durationSec?: number;
}
