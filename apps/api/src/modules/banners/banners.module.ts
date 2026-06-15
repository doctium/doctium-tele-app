import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { BannersService } from "./banners.service";
import {
  BannersController,
  AdminBannersController,
} from "./banners.controller";

@Module({
  imports: [AuthModule],
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService, CloudinaryService],
})
export class BannersModule {}
