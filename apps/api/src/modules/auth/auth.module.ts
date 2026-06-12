import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { prisma } from "@doctium/database";
import { MailerProvider } from "../notifications/channels/mailer.provider";
import { SmsProvider } from "../notifications/channels/sms.provider";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    MailerProvider,
    SmsProvider,
    { provide: "PRISMA", useValue: prisma },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
