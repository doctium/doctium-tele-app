import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { MailerProvider } from "../notifications/channels/mailer.provider";
import { MediaService } from "./media.service";
import { MediaController } from "./media.controller";
import { AdminMediaController } from "./admin-media.controller";

@Module({
  imports: [AuthModule],
  controllers: [MediaController, AdminMediaController],
  providers: [MediaService, CloudinaryService, MailerProvider],
})
export class MediaModule {}
