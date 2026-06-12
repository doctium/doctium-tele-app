import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { renderEmailVerifiedPage } from "./email-verified.page";
import {
  LoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  RegisterDoctorDto,
  RegisterUserDto,
  DoctorSignupOtpDto,
  DoctorSignupDto,
} from "./dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("user/register")
  registerUser(@Body() dto: RegisterUserDto) {
    return this.authService.registerUser(dto);
  }

  @Post("user/login")
  loginUser(@Body() dto: LoginDto) {
    return this.authService.loginUser(dto);
  }

  @Post("user/otp/send")
  sendOtp(@Body() dto: OtpRequestDto) {
    return this.authService.sendOtp(dto.mobile);
  }

  @Post("user/otp/verify")
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.authService.verifyOtp(dto);
  }

  // ── Patient email verification ──────────────────────────────
  @Post("email-verification/send")
  sendEmailVerification(@Body() dto: { email: string }) {
    return this.authService.sendUserEmailVerification(dto.email ?? "");
  }

  @Post("email-verification/verify")
  verifyEmail(@Body() dto: { email: string; code: string }) {
    return this.authService.verifyUserEmail(dto.email ?? "", dto.code ?? "");
  }

  /** One-click link from the verification email → branded HTML result page. */
  @Get("verify-email")
  async verifyEmailLink(@Query("token") token: string, @Res() res: Response) {
    const result = await this.authService.verifyUserEmailByToken(token ?? "");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderEmailVerifiedPage(result.ok));
  }

  // Admin-created doctors (no OTP) — kept for internal/admin use
  @Post("doctor/register-direct")
  registerDoctor(@Body() dto: RegisterDoctorDto) {
    return this.authService.registerDoctor(dto);
  }

  // Doctor self-signup, step 1: send 6-digit OTPs to email + phone
  @Post("doctor/register/send-otp")
  sendDoctorSignupOtp(@Body() dto: DoctorSignupOtpDto) {
    return this.authService.sendDoctorSignupOtp(dto);
  }

  // Doctor self-signup, step 2: verify both OTPs and create the account (status NEW)
  @Post("doctor/register")
  signupDoctor(@Body() dto: DoctorSignupDto) {
    return this.authService.signupDoctor(dto);
  }

  @Post("doctor/login")
  loginDoctor(@Body() dto: LoginDto) {
    return this.authService.loginDoctor(dto);
  }

  @Post("admin/login")
  loginAdmin(@Body() dto: LoginDto) {
    return this.authService.loginAdmin(dto);
  }
}
