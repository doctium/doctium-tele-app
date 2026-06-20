import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { MailerProvider } from "../notifications/channels/mailer.provider";
import { HrController } from "./hr.controller";
import { HrService } from "./hr.service";
import { RbacService } from "./rbac.service";
import { AuditService } from "./audit.service";

@Module({
  imports: [AuthModule],
  controllers: [HrController],
  providers: [
    HrService,
    RbacService,
    AuditService,
    CloudinaryService,
    MailerProvider,
  ],
  exports: [AuditService],
})
export class HrModule {}
