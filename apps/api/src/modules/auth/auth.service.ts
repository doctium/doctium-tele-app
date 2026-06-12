import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, randomInt } from "crypto";
import * as bcrypt from "bcrypt";
import { prisma, Prisma } from "@doctium/database";
import { AuthTokens, JwtPayload } from "@doctium/types";
import {
  LoginDto,
  OtpVerifyDto,
  RegisterUserDto,
  RegisterDoctorDto,
  DoctorSignupOtpDto,
  DoctorSignupDto,
} from "./dto";
import { MailerProvider } from "../notifications/channels/mailer.provider";
import { SmsProvider } from "../notifications/channels/sms.provider";
import { requireEnv } from "../../common/env";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Never log live codes in production — only as a dev convenience when no provider is wired. */
  private get isDev(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailer: MailerProvider,
    private readonly sms: SmsProvider,
  ) {}

  // ── Referral codes ──────────────────────────────────────────
  /** Unambiguous charset (no 0/O/1/I) so codes survive being read aloud. */
  private static readonly CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  /** Max wrong guesses before an OTP is burned and the user must request a new one. */
  private static readonly OTP_MAX_ATTEMPTS = 5;

  private generateReferralCode(): string {
    let code = "";
    for (let i = 0; i < 10; i++)
      code += AuthService.CODE_CHARS.charAt(
        randomInt(AuthService.CODE_CHARS.length),
      );
    return code;
  }

  /** Cryptographically-random 6-digit code (100000–999999). */
  private sixDigit(): string {
    return randomInt(100000, 1000000).toString();
  }

  /**
   * Validate a submitted code against the active OTP for an identifier, counting
   * failures and burning the code once the attempt cap is hit. Returns the row id
   * on success so the caller can finalise/delete it. Brute-forcing a 6-digit code
   * is already throttled per-IP at the controller; this caps guesses per code too.
   */
  private async verifyOtpRecord(
    where: Prisma.OtpWhereInput,
    code: string,
  ): Promise<string> {
    const record = await prisma.otp.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw new BadRequestException("Invalid or expired code");
    if (record.expiresAt < new Date()) {
      await prisma.otp.delete({ where: { id: record.id } });
      throw new BadRequestException("Code expired — request a new one");
    }
    if (record.attempts >= AuthService.OTP_MAX_ATTEMPTS) {
      await prisma.otp.delete({ where: { id: record.id } });
      throw new BadRequestException(
        "Too many incorrect attempts — request a new code",
      );
    }
    if (record.otp !== code.trim()) {
      await prisma.otp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Invalid code");
    }
    return record.id;
  }

  /** Generate a code that isn't taken yet (collisions are ~impossible, but cheap to guard). */
  async uniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateReferralCode();
      const taken = await prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!taken) return code;
    }
    throw new BadRequestException("Could not generate a referral code");
  }

  async registerUser(dto: RegisterUserDto): Promise<AuthTokens> {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { mobile: dto.mobile }] },
    });
    if (existing) throw new BadRequestException("Account already exists");

    // The incoming code belongs to the REFERRER — never spread it into the
    // new user's own row.
    const { referralCode: incomingCode, ...rest } = dto;
    let referredById: string | null = null;
    if (incomingCode?.trim()) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: incomingCode.trim().toUpperCase() },
        select: { id: true, isDelete: true },
      });
      if (!referrer || referrer.isDelete)
        throw new BadRequestException("That referral code doesn't exist");
      referredById = referrer.id;
    }

    const password = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;
    const user = await prisma.user.create({
      data: {
        ...rest,
        password,
        referralCode: await this.uniqueReferralCode(),
        referredById,
      },
    });

    await prisma.userWallet.create({ data: { userId: user.id } });
    // Kick off email verification (fire-and-forget; no-op without an email).
    if (user.email) this.sendUserEmailVerification(user.email).catch(() => {});
    return this.generateTokens(user.id, user.email ?? "", "user");
  }

  // ── Patient email verification (6-digit OTP or emailed link) ──

  /** Send/re-send the verification email: a 6-digit code + a one-click link. */
  async sendUserEmailVerification(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, isDelete: false },
      select: { id: true, emailVerified: true },
    });
    if (!user) throw new NotFoundException("No account with that email");
    if (user.emailVerified) return { message: "Email already verified" };

    const code = this.sixDigit();
    const linkToken = `evl_${randomBytes(24).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    // One active code + one active link per email.
    await prisma.otp.deleteMany({ where: { email, mobile: "" } });
    await prisma.otp.create({
      data: { email, mobile: "", otp: code, expiresAt },
    });
    await prisma.otp.create({
      data: { email, mobile: "", otp: linkToken, expiresAt },
    });

    const apiUrl = process.env.API_PUBLIC_URL || "http://localhost:3001";
    const link = `${apiUrl}/api/v1/auth/verify-email?token=${linkToken}`;
    await this.mailer.sendEmail(
      email,
      "Verify your Doctium email",
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F1B2D">
        <h2 style="color:#133157;margin:0 0 8px">Verify your email</h2>
        <p style="color:#5A6B82">Welcome to Doctium! Enter this code in the app:</p>
        <p style="font-size:30px;font-weight:800;letter-spacing:6px;color:#133157;margin:8px 0">${code}</p>
        <p style="color:#5A6B82">Or verify with one click:</p>
        <a href="${link}" style="display:block;text-align:center;background:#133157;color:#fff;text-decoration:none;padding:13px;border-radius:10px;font-weight:bold">Verify my email</a>
        <p style="color:#93A1B5;font-size:12px;margin-top:14px">This code and link expire in 30 minutes. If you didn't create a Doctium account, ignore this email.</p>
      </div>`,
    );
    // Dev convenience when SMTP isn't configured yet (mirrors sendOtp).
    if (!this.mailer.isConfigured() && this.isDev)
      this.logger.debug(
        `Email verification code for ${email}: ${code} (${link})`,
      );
    return { message: "Verification email sent" };
  }

  /** In-app path: the 6-digit code typed on the verify screen. */
  async verifyUserEmail(rawEmail: string, code: string) {
    const email = rawEmail.trim().toLowerCase();
    // Match the numeric code row, not the one-click link row (prefixed evl_).
    await this.verifyOtpRecord(
      { email, mobile: "", NOT: { otp: { startsWith: "evl_" } } },
      code,
    );
    await this.markEmailVerified(email);
    return { verified: true };
  }

  /** One-click path: the emailed link. Returns data for the HTML page. */
  async verifyUserEmailByToken(token: string) {
    if (!token?.startsWith("evl_")) return { ok: false as const };
    const record = await prisma.otp.findFirst({
      where: { otp: token, mobile: "", expiresAt: { gt: new Date() } },
    });
    if (!record?.email) return { ok: false as const };
    await this.markEmailVerified(record.email);
    return { ok: true as const, email: record.email };
  }

  private async markEmailVerified(email: string) {
    await prisma.user.updateMany({
      where: { email: { equals: email, mode: "insensitive" } },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
    await prisma.otp.deleteMany({ where: { email, mobile: "" } });
  }

  async registerDoctor(dto: RegisterDoctorDto): Promise<AuthTokens> {
    const existing = await prisma.doctor.findFirst({
      where: { OR: [{ email: dto.email }, { mobile: dto.mobile }] },
    });
    if (existing) throw new BadRequestException("Account already exists");

    // referralCode is a patient-program field inherited from RegisterUserDto —
    // the Doctor model has no such column.
    const { referralCode: _ignored, ...rest } = dto;
    const password = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;
    const doctor = await prisma.doctor.create({
      data: { ...rest, password },
    });

    await prisma.doctorWallet.create({ data: { doctorId: doctor.id } });
    return this.generateTokens(doctor.id, doctor.email, "doctor");
  }

  // ── Doctor self-signup with email + phone OTP ──────────────
  private otpEmailHtml(code: string): string {
    return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F1B2D">
      <h2 style="color:#133157;margin:0 0 8px">Verify your email</h2>
      <p style="color:#5A6B82">Your Doctium verification code is:</p>
      <p style="font-size:30px;font-weight:800;letter-spacing:6px;color:#133157;margin:8px 0">${code}</p>
      <p style="color:#93A1B5;font-size:12px">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
    </div>`;
  }

  /** Step 1: send 6-digit OTPs to the doctor's email and phone. */
  async sendDoctorSignupOtp(dto: DoctorSignupOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const existing = await prisma.doctor.findFirst({
      where: { OR: [{ email }, { mobile: phone }] },
    });
    if (existing)
      throw new BadRequestException(
        "An account with that email or phone already exists",
      );

    const emailCode = this.sixDigit();
    const phoneCode = this.sixDigit();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otp.deleteMany({
      where: { OR: [{ email }, { mobile: phone }] },
    });
    await prisma.otp.create({
      data: { email, mobile: "", otp: emailCode, expiresAt },
    });
    await prisma.otp.create({
      data: { email: "", mobile: phone, otp: phoneCode, expiresAt },
    });

    await this.mailer.sendEmail(
      email,
      "Your Doctium verification code",
      this.otpEmailHtml(emailCode),
    );
    await this.sms.sendSms(
      phone,
      `Your Doctium verification code is ${phoneCode}`,
    );

    // In non-production (or when no SMS/email provider is configured) return the codes so signup is testable.
    const dev = process.env.NODE_ENV !== "production";
    return {
      sent: true,
      ...(dev ? { devEmailCode: emailCode, devPhoneCode: phoneCode } : {}),
    };
  }

  /** Step 2: verify both OTPs, then create the doctor (status NEW → admin "New Registrations"). */
  async signupDoctor(dto: DoctorSignupDto): Promise<AuthTokens> {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();

    await this.verifyOtpRecord({ email, mobile: "" }, dto.emailCode);
    await this.verifyOtpRecord({ mobile: phone, email: "" }, dto.phoneCode);

    const existing = await prisma.doctor.findFirst({
      where: { OR: [{ email }, { mobile: phone }] },
    });
    if (existing)
      throw new BadRequestException(
        "An account with that email or phone already exists",
      );

    const designation =
      dto.speciality === "Consultant" && dto.consultantSpeciality?.trim()
        ? `Consultant — ${dto.consultantSpeciality.trim()}`
        : dto.speciality;

    const password = await bcrypt.hash(dto.password, 12);
    const doctor = await prisma.doctor.create({
      data: {
        name: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
        email,
        mobile: phone,
        password,
        designation,
        language: dto.languages ?? [],
        verificationStatus: "NEW",
        emailVerified: true,
        phoneVerified: true,
      },
    });
    await prisma.doctorWallet.create({ data: { doctorId: doctor.id } });
    await prisma.otp.deleteMany({
      where: { OR: [{ email }, { mobile: phone }] },
    });

    // Confirmation email to the doctor + alerts to reviewing admins (in-app bell + email).
    // All non-blocking — signup must never fail on a notification error.
    this.mailer
      .sendEmail(
        doctor.email,
        "Welcome to Doctium — your registration is under review",
        this.doctorWelcomeHtml(dto.firstName.trim()),
      )
      .catch(() => {});

    prisma.adminNotification
      .create({
        data: {
          type: "DOCTOR_SIGNUP",
          title: "New doctor registration",
          body: `${doctor.name} (${doctor.designation ?? "Doctor"}) signed up and is awaiting review.`,
          link: `/doctors/${doctor.id}`,
        },
      })
      .catch(() => {});

    this.notifyAdminsOfDoctorSignup({
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      mobile: doctor.mobile,
      designation: doctor.designation,
    }).catch(() => {});

    return this.generateTokens(doctor.id, doctor.email, "doctor");
  }

  private doctorWelcomeHtml(firstName: string): string {
    return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F1B2D">
      <h2 style="color:#133157;margin:0 0 8px">Welcome to Doctium, Dr. ${firstName} 👋</h2>
      <p style="color:#5A6B82;line-height:1.5">Thanks for registering. Your account has been created and your <b>registration is now under review</b> by our team.</p>
      <p style="color:#5A6B82;line-height:1.5">Next step: open the Doctium for Doctors app and upload your verification documents (MDCN practising licence, a government ID, and your CV) so we can verify you and make your profile visible to patients.</p>
      <p style="color:#93A1B5;font-size:12px;margin-top:18px">We'll email you as soon as your review is complete.</p>
    </div>`;
  }

  /** Email admins who review doctors (super admins + anyone with doctors.verify/manage) about a new signup. */
  private async notifyAdminsOfDoctorSignup(doctor: {
    id: string;
    name: string;
    email: string;
    mobile: string;
    designation: string | null;
  }): Promise<void> {
    const reviewers = await prisma.employee.findMany({
      where: {
        isActive: true,
        email: { not: "" },
        OR: [
          { isSuperAdmin: true },
          {
            role: {
              permissions: { hasSome: ["doctors.verify", "doctors.manage"] },
            },
          },
        ],
      },
      select: { email: true },
    });
    const recipients = [
      ...new Set(reviewers.map((r) => r.email).filter(Boolean)),
    ];
    if (recipients.length === 0) return;

    const base = (
      process.env.PUBLIC_WEB_URL ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const link = `${base}/doctors/${doctor.id}`;
    const row = (label: string, value: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#93A1B5;font-size:13px">${label}</td><td style="padding:4px 0;color:#0F1B2D;font-size:13px;font-weight:600">${value}</td></tr>`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F1B2D">
      <h2 style="color:#133157;margin:0 0 6px">New doctor registration</h2>
      <p style="color:#5A6B82;margin:0 0 16px">A doctor just signed up and is awaiting review under <b>New Registrations</b>.</p>
      <table style="border-collapse:collapse;margin-bottom:20px">
        ${row("Name", doctor.name)}
        ${row("Email", doctor.email)}
        ${row("Phone", doctor.mobile)}
        ${row("Speciality", doctor.designation ?? "—")}
      </table>
      <a href="${link}" style="display:inline-block;background:#133157;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Review registration</a>
      <p style="color:#93A1B5;font-size:12px;margin-top:18px">Or open: <a href="${link}" style="color:#2E7CC2">${link}</a></p>
    </div>`;

    await Promise.all(
      recipients.map((to) =>
        this.mailer.sendEmail(
          to,
          "New doctor registration — review required",
          html,
        ),
      ),
    );
  }

  async loginUser(dto: LoginDto): Promise<AuthTokens> {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { mobile: dto.mobile }] },
    });
    if (!user || !user.password)
      throw new UnauthorizedException("Invalid credentials");
    if (user.isBlock)
      throw new UnauthorizedException(
        "Your Doctium account has been temporarily turned off. Contact Doctium support for more information.",
      );

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return this.generateTokens(user.id, user.email ?? "", "user");
  }

  async loginDoctor(dto: LoginDto): Promise<AuthTokens> {
    const doctor = await prisma.doctor.findFirst({
      where: { OR: [{ email: dto.email }, { mobile: dto.mobile }] },
    });
    if (!doctor || !doctor.password)
      throw new UnauthorizedException("Invalid credentials");
    if (doctor.isBlock)
      throw new UnauthorizedException(
        "Your account with Doctium has been temporarily turned off. Contact Doctium support for more information.",
      );

    const valid = await bcrypt.compare(dto.password, doctor.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return this.generateTokens(doctor.id, doctor.email, "doctor");
  }

  async loginAdmin(dto: LoginDto): Promise<AuthTokens> {
    // The admin-panel principal is now an Employee with panel access.
    const employee = await prisma.employee.findUnique({
      where: { email: dto.email },
    });
    if (!employee || !employee.password)
      throw new UnauthorizedException("Invalid credentials");
    if (!employee.canLogin || !employee.isActive)
      throw new UnauthorizedException("Account has no panel access");

    const valid = await bcrypt.compare(dto.password, employee.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return this.generateTokens(employee.id, employee.email, "admin");
  }

  async sendOtp(mobile: string): Promise<{ message: string }> {
    const otp = this.sixDigit();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otp.deleteMany({ where: { mobile } });
    await prisma.otp.create({ data: { mobile, otp, expiresAt } });

    await this.sms.sendSms(mobile, `Your Doctium verification code is ${otp}`);
    // Dev convenience when no SMS provider is configured — never log codes in production.
    if (this.isDev) this.logger.debug(`OTP for ${mobile}: ${otp}`);
    return { message: "OTP sent successfully" };
  }

  async verifyOtp(dto: OtpVerifyDto): Promise<AuthTokens> {
    const otpId = await this.verifyOtpRecord(
      { mobile: dto.mobile, email: "" },
      dto.otp,
    );
    await prisma.otp.delete({ where: { id: otpId } });

    let user = await prisma.user.findFirst({ where: { mobile: dto.mobile } });
    if (user?.isBlock)
      throw new UnauthorizedException(
        "Your Doctium account has been temporarily turned off. Contact Doctium support for more information.",
      );
    if (!user) {
      user = await prisma.user.create({
        data: { mobile: dto.mobile, loginType: "MOBILE" },
      });
      await prisma.userWallet.create({ data: { userId: user.id } });
    }

    return this.generateTokens(user.id, user.email ?? "", "user");
  }

  private generateTokens(
    sub: string,
    email: string,
    role: JwtPayload["role"],
  ): AuthTokens {
    const payload: JwtPayload = { sub, email, role };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: requireEnv("JWT_REFRESH_SECRET"),
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
      }),
    };
  }
}
