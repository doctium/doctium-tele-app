import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { CommsService } from "./comms.service";
import { CommsController } from "./comms.controller";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [CommsController],
  providers: [CommsService, CloudinaryService],
})
export class CommsModule {}
