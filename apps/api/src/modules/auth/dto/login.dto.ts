import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() mobile?: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
}

export class OtpRequestDto {
  @ApiProperty() @IsString() mobile: string;
}

export class OtpVerifyDto {
  @ApiProperty() @IsString() mobile: string;
  @ApiProperty() @IsString() otp: string;
}

export class RefreshTokenDto {
  @ApiProperty() @IsString() refreshToken: string;
}
