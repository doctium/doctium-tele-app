import { Module } from "@nestjs/common";
import { DoctorsController } from "./doctors.controller";
import { DoctorsService } from "./doctors.service";
import { AuthModule } from "../auth/auth.module";
import { CloudinaryService } from "../prescriptions/cloudinary.service";

@Module({
  imports: [AuthModule],
  controllers: [DoctorsController],
  providers: [DoctorsService, CloudinaryService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
