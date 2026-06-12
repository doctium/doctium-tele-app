import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("wallet")
  @UseGuards(RolesGuard)
  @Roles("user")
  getWallet(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.getUserWallet(user.sub);
  }

  // NOTE: the old `POST wallet/topup` direct-credit route was removed — it let a
  // patient credit their own wallet with no payment. Real funding goes through
  // `wallet/topup/init` → Paystack → webhook. Super-admin manual credits live in
  // the admin module (`admin.service` Add Funds, behind the `wallet.topup` permission).

  @Post("wallet/topup/init")
  @UseGuards(RolesGuard)
  @Roles("user")
  initTopup(@CurrentUser() user: JwtPayload, @Body("amount") amount: number) {
    return this.paymentsService.initTopup(user.sub, amount);
  }

  @Get("wallet/dva")
  @UseGuards(RolesGuard)
  @Roles("user")
  getDVA(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.getOrCreateDVA(user.sub);
  }

  @Post("appointment/:id/init")
  @UseGuards(RolesGuard)
  @Roles("user")
  payAppointment(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.paymentsService.initAppointmentPayment(user.sub, id);
  }

  @Get("doctor/wallet")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  getDoctorWallet(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.getDoctorWallet(user.sub);
  }

  @Get("doctor/wallet/stats")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  getDoctorEarningsStats(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.getDoctorEarningsStats(user.sub);
  }

  @Get("doctor/withdraw-methods")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  getWithdrawMethods(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.getDoctorWithdrawMethods(user.sub);
  }

  @Post("doctor/withdraw-methods")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  saveWithdrawMethod(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.paymentsService.saveDoctorWithdrawMethod(user.sub, dto);
  }

  @Post("doctor/withdraw")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  requestWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Body()
    dto: {
      amount: number;
      withdrawMethodId?: string;
      bankDetails?: {
        accountNumber?: string;
        bankCode?: string;
        bankName?: string;
        accountName?: string;
      };
    },
  ) {
    return this.paymentsService.requestWithdrawal(user.sub, dto);
  }

  @Get("doctor/withdraw-requests")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  getRequests(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.getWithdrawRequests(user.sub);
  }

  @Get("banks")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  getBanks() {
    return this.paymentsService.getBanks();
  }

  @Get("resolve-account")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  resolveAccount(
    @Query("accountNumber") accountNumber: string,
    @Query("bankCode") bankCode: string,
  ) {
    return this.paymentsService.resolveAccount(accountNumber, bankCode);
  }
}
