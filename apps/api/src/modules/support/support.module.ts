import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { SupportService } from "./support.service";
import { SupportGateway } from "./support.gateway";
import {
  SupportController,
  AdminSupportController,
} from "./support.controller";

@Module({
  imports: [AuthModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, SupportGateway, CloudinaryService],
  exports: [SupportGateway],
})
export class SupportModule {}
