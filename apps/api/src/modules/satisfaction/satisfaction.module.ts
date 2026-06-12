import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import {
  AdminSatisfactionController,
  SatisfactionController,
} from "./satisfaction.controller";
import { SatisfactionService } from "./satisfaction.service";

@Module({
  imports: [NotificationsModule],
  controllers: [SatisfactionController, AdminSatisfactionController],
  providers: [SatisfactionService],
  exports: [SatisfactionService],
})
export class SatisfactionModule {}
