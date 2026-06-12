import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { AdminService } from "./admin.service";
import { PlansService } from "../subscriptions/plans.service";
import { BillingService } from "../subscriptions/billing.service";
import {
  CreatePlanDto,
  UpdatePlanDto,
} from "../subscriptions/dto/subscriptions.dto";
import { KycService } from "../kyc/kyc.service";
import { AuditService } from "../hr/audit.service";
import { AppointmentRemindersService } from "../appointments/appointment-reminders.service";
import { AppointmentsService } from "../appointments/appointments.service";
import { FollowUpsService } from "../appointments/follow-ups.service";
import { ReferralsService } from "../referrals/referrals.service";
import { EmrService } from "../emr/emr.service";
import { FhirService } from "../emr/fhir.service";
import {
  CreateDoctorDto,
  ReviewDocDto,
  VerifyDoctorDto,
  UploadKycDocDto,
} from "../kyc/dto/kyc.dto";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly plans: PlansService,
    private readonly billing: BillingService,
    private readonly kyc: KycService,
    private readonly audit: AuditService,
    private readonly appointmentsSvc: AppointmentsService,
    private readonly reminders: AppointmentRemindersService,
    private readonly followUps: FollowUpsService,
    private readonly referralsSvc: ReferralsService,
    private readonly emr: EmrService,
    private readonly fhir: FhirService,
  ) {}

  // ─── Dashboard ───────────────────────────────────────────
  @Permissions("dashboard.view")
  @Get("dashboard")
  stats(@Query("startDate") s?: string, @Query("endDate") e?: string) {
    return this.adminService.getDashboardStats(s, e);
  }

  @Permissions("dashboard.view")
  @Get("top-doctors")
  topDoctors(@Query("startDate") s?: string, @Query("endDate") e?: string) {
    return this.adminService.getTopDoctors(s, e);
  }

  @Permissions("dashboard.view")
  @Get("upcoming")
  upcoming() {
    return this.adminService.getUpcomingAppointments();
  }

  @Permissions("dashboard.view")
  @Get("chart")
  chart(@Query("startDate") s?: string, @Query("endDate") e?: string) {
    return this.adminService.getChart(s, e);
  }

  // ─── Users ───────────────────────────────────────────────
  @Permissions("users.view")
  @Get("users")
  users(@Query("page") page = 1, @Query("limit") limit = 20) {
    return this.adminService.getAllUsers(+page, +limit);
  }

  @Permissions("users.view")
  @Get("users/:id")
  userDetail(@Param("id") id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Permissions("users.view")
  @Get("users/:id/appointments")
  userAppointments(@Param("id") id: string) {
    return this.adminService.getUserAppointments(id);
  }

  @Permissions("users.manage")
  @Patch("users/:id/block")
  blockUser(@Param("id") id: string, @Body("isBlock") isBlock: boolean) {
    return this.adminService.toggleBlockUser(id, isBlock);
  }

  // ─── Doctors ─────────────────────────────────────────────
  @Permissions("doctors.view")
  @Get("doctors")
  doctors(@Query("page") page = 1, @Query("limit") limit = 20) {
    return this.adminService.getAllDoctors(+page, +limit);
  }

  @Permissions("doctors.view")
  @Get("doctors/:id")
  doctorDetail(@Param("id") id: string) {
    return this.adminService.getDoctorDetail(id);
  }

  @Permissions("doctors.manage")
  @Patch("doctors/:id/block")
  blockDoctor(@Param("id") id: string, @Body("isBlock") isBlock: boolean) {
    return this.adminService.toggleBlockDoctor(id, isBlock);
  }

  /** Business Agreement: doctor-specific commission (0 = app-wide default applies). */
  @Permissions("doctors.manage")
  @Patch("doctors/:id/commission")
  async setDoctorCommission(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body("commission") commission: number,
  ) {
    const r = await this.adminService.setDoctorCommission(
      id,
      Number(commission),
    );
    await this.audit.log(admin.sub, "doctor.commission", "doctor", id, {
      from: r.previous,
      to: r.commission,
    });
    return r;
  }

  // ─── Add Funds (manual wallet credit) ────────────────────
  @Permissions("finance.manage")
  @Get("users-search")
  searchUsersForFinance(@Query("q") q: string) {
    return this.adminService.searchUsersForFinance(q);
  }

  @Permissions("finance.manage")
  @Post("users/:id/wallet-credit")
  async creditUserWallet(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body("amount") amount: number,
  ) {
    const r = await this.adminService.creditUserWallet(
      id,
      Math.round(Number(amount)),
    );
    await this.audit.log(admin.sub, "user.wallet-credit", "user", id, {
      amount: r.credited,
      reference: r.reference,
    });
    return r;
  }

  // ─── MediGram moderation ─────────────────────────────────
  @Permissions("content.moderate")
  @Get("videos")
  videos(
    @Query("status") status?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.adminService.getVideos(status, +page, +limit);
  }

  @Permissions("content.moderate")
  @Get("videos/:id")
  videoDetail(@Param("id") id: string) {
    return this.adminService.getVideoDetail(id);
  }

  @Permissions("content.moderate")
  @Patch("videos/:id/approve")
  approveVideo(@Param("id") id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.approveVideo(id, admin?.sub);
  }

  @Permissions("content.moderate")
  @Patch("videos/:id/reject")
  rejectVideo(
    @Param("id") id: string,
    @Body("reason") reason: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.rejectVideo(id, reason, admin?.sub);
  }

  @Permissions("content.moderate")
  @Delete("videos/:id")
  deleteVideo(@Param("id") id: string) {
    return this.adminService.deleteVideo(id);
  }

  // ─── EMR oversight ───────────────────────────────────────
  @Permissions("emr.view")
  @Get("emr/patients")
  emrPatients(
    @Query("search") search?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.emr.adminListPatients(search, +page, +limit);
  }

  @Permissions("emr.view")
  @Get("emr/patient/:userId")
  emrPatient(@Param("userId") userId: string) {
    return this.emr.adminGetRecord(userId);
  }

  @Permissions("emr.export")
  @Get("emr/patient/:userId/fhir")
  emrPatientFhir(@Param("userId") userId: string) {
    return this.fhir.exportPatient(userId);
  }

  // ─── Referrals oversight ─────────────────────────────────
  @Permissions("appointments.view")
  @Get("referrals")
  referrals(
    @Query("status") status?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.referralsSvc.adminList(status, +page, +limit);
  }

  @Permissions("appointments.view")
  @Get("referrals/funnel")
  referralFunnel() {
    return this.referralsSvc.adminFunnel();
  }

  @Permissions("appointments.view")
  @Post("run-referral-expiry")
  async runReferralExpiry() {
    return { expired: await this.referralsSvc.expireOverdue() };
  }

  // --- Recording oversight -------------------------------------------------
  @Permissions("appointments.view")
  @Get("recordings")
  recordings(
    @Query("status") status?: string,
    @Query("retention") retention?: string,
    @Query("search") search?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.appointmentsSvc.adminListRecordings({
      status,
      retention,
      search,
      page: +page,
      limit: +limit,
    });
  }

  @Permissions("appointments.view")
  @Get("recordings/:appointmentId")
  recordingDetail(@Param("appointmentId") appointmentId: string) {
    return this.appointmentsSvc.adminGetRecording(appointmentId);
  }

  @Permissions("appointments.manage_recordings")
  @Post("recordings/:appointmentId/assets")
  registerRecordingAsset(
    @Param("appointmentId") appointmentId: string,
    @CurrentUser() admin: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.appointmentsSvc.registerRecordingAssets(
      appointmentId,
      body,
      admin,
    );
  }

  @Permissions("appointments.manage_recordings")
  @Patch("recordings/assets/:assetId/retention")
  updateRecordingRetention(
    @Param("assetId") assetId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.appointmentsSvc.adminUpdateRecordingAssetRetention(
      assetId,
      body,
    );
  }

  @Permissions("appointments.manage_recordings")
  @Post("recordings/run-retention")
  runRecordingRetention() {
    return this.appointmentsSvc.runRecordingRetention();
  }

  @Permissions("appointments.view")
  @Get("recording-requests")
  recordingRequests(
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.appointmentsSvc.adminListRecordingRequests({
      status,
      type,
      page: +page,
      limit: +limit,
    });
  }

  @Permissions("appointments.manage_recordings")
  @Patch("recording-requests/:requestId")
  decideRecordingRequest(
    @Param("requestId") requestId: string,
    @CurrentUser() admin: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.appointmentsSvc.adminDecideRecordingRequest(
      requestId,
      admin,
      body,
    );
  }

  // ─── Doctor verification / KYC ───────────────────────────
  @Permissions("doctors.verify")
  @Get("doctor-registrations")
  doctorRegistrations(
    @Query("status") status?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.kyc.listForAdmin(status, +page, +limit);
  }

  @Permissions("doctors.verify")
  @Get("doctors/:id/kyc")
  doctorKyc(@Param("id") id: string) {
    return this.kyc.getDoctorKyc(id);
  }

  @Permissions("doctors.verify")
  @Post("doctors")
  createDoctor(@Body() body: CreateDoctorDto) {
    return this.kyc.createDoctorByAdmin(body);
  }

  @Permissions("doctors.verify")
  @Patch("doctors/:id/approve-registration")
  approveRegistration(@Param("id") id: string) {
    return this.kyc.approveRegistration(id);
  }

  @Permissions("doctors.verify")
  @Patch("doctors/:id/verify")
  async verifyDoctor(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body() body: VerifyDoctorDto,
  ) {
    const r = await this.kyc.verifyDoctor(id, body, admin.sub);
    await this.audit.log(admin.sub, "doctor.verify", "doctor", id);
    return r;
  }

  @Permissions("doctors.verify")
  @Patch("doctors/:id/reject")
  async rejectDoctor(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body("reason") reason: string,
  ) {
    const r = await this.kyc.rejectDoctor(id, reason, admin.sub);
    await this.audit.log(admin.sub, "doctor.reject", "doctor", id, { reason });
    return r;
  }

  @Permissions("doctors.verify")
  @Patch("kyc-documents/:id/review")
  reviewKycDoc(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body() body: ReviewDocDto,
  ) {
    return this.kyc.reviewDocument(id, body, admin.sub);
  }

  // Upload a KYC document on a doctor's behalf (e.g. hard copies handed in at the office).
  @Permissions("doctors.verify")
  @Post("doctors/:id/kyc-documents")
  async uploadKycForDoctor(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body() body: UploadKycDocDto,
  ) {
    const r = await this.kyc.uploadDocument(id, body);
    await this.audit.log(admin.sub, "doctor.kyc-upload", "doctor", id, {
      type: body.type,
    });
    return r;
  }

  // Submit a doctor's KYC for review on their behalf.
  @Permissions("doctors.verify")
  @Patch("doctors/:id/submit-kyc")
  async submitKycForDoctor(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
  ) {
    const r = await this.kyc.submitForReview(id);
    await this.audit.log(admin.sub, "doctor.kyc-submit", "doctor", id);
    return r;
  }

  // ─── Admin notifications (bell) ──────────────────────────
  @Get("notifications")
  notifications(@Query("limit") limit = 20) {
    return this.adminService.getNotifications(+limit);
  }

  @Get("notifications/unread-count")
  notificationsUnread() {
    return this.adminService.getUnreadNotificationCount();
  }

  @Patch("notifications/read-all")
  readAllNotifications() {
    return this.adminService.markAllNotificationsRead();
  }

  @Patch("notifications/:id/read")
  readNotification(@Param("id") id: string) {
    return this.adminService.markNotificationRead(id);
  }

  @Permissions("doctors.verify")
  @Post("run-license-check")
  runLicenseCheck() {
    return this.kyc.runLicenseCheck();
  }

  /** Manual trigger for the appointment-reminder sweep (ops / testing). */
  @Permissions("appointments.view")
  @Post("run-appointment-reminders")
  runAppointmentReminders() {
    return this.reminders.sendDueReminders();
  }

  /** Manual trigger for the follow-up / no-show-recovery sweep (ops / testing). */
  @Permissions("appointments.view")
  @Post("run-follow-ups")
  runFollowUps() {
    return this.followUps.runAllManual();
  }

  // ─── Appointments ────────────────────────────────────────
  @Permissions("appointments.view")
  @Get("appointments")
  appointments(
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("search") search?: string,
  ) {
    return this.adminService.getAppointments({
      page: +page,
      limit: +limit,
      status,
      startDate,
      endDate,
      search,
    });
  }

  /** Navbar global search — booking IDs, patients, doctors, services. */
  @Permissions("dashboard.view")
  @Get("search")
  globalSearch(@Query("q") q = "") {
    return this.adminService.globalSearch(q);
  }

  /** Order-details page behind the "There's a New Patient Booking" alert. */
  @Permissions("appointments.view")
  @Get("appointments/:id")
  appointmentDetail(@Param("id") id: string) {
    return this.adminService.getAppointmentDetail(id);
  }

  // ─── Reviews ─────────────────────────────────────────────
  @Permissions("content.view")
  @Get("reviews")
  reviews(@Query("page") page = 1, @Query("limit") limit = 20) {
    return this.adminService.getReviews(+page, +limit);
  }

  @Permissions("content.moderate")
  @Delete("reviews/:id")
  deleteReview(@Param("id") id: string) {
    return this.adminService.deleteReview(id);
  }

  // ─── Complaints ──────────────────────────────────────────
  @Permissions("content.view")
  @Get("complains")
  complaints(@Query("role") role?: string) {
    return this.adminService.getComplaints(role);
  }

  @Permissions("content.moderate")
  @Patch("complains/:id")
  updateComplaint(@Param("id") id: string, @Body("status") status: string) {
    return this.adminService.updateComplaint(id, status);
  }

  // ─── Settings ────────────────────────────────────────────
  @Permissions("settings.manage")
  @Get("settings")
  settings() {
    return this.adminService.getSettings();
  }

  @Permissions("settings.manage")
  @Patch("settings")
  updateSetting(@Body() body: { key: string; value: string }) {
    return this.adminService.updateSetting(body.key, body.value);
  }

  // ─── Admin profile & password ────────────────────────────
  /** Current admin identity + live RBAC for the panel's auth context (no permission gate). */
  @Get("me")
  me(@CurrentUser() admin: JwtPayload) {
    return this.adminService.getMe(admin.sub);
  }

  @Get("profile")
  profile(@CurrentUser() admin: JwtPayload) {
    return this.adminService.getProfile(admin.sub);
  }

  @Patch("profile")
  updateProfile(
    @CurrentUser() admin: JwtPayload,
    @Body() body: { name?: string; email?: string; image?: string },
  ) {
    return this.adminService.updateProfile(admin.sub, body);
  }

  @Put("password")
  changePassword(
    @CurrentUser() admin: JwtPayload,
    @Body()
    body: { oldPassword: string; newPassword: string; confirmPassword: string },
  ) {
    return this.adminService.changePassword(admin.sub, body);
  }

  // ─── Services & suggested services ───────────────────────
  @Permissions("catalog.manage")
  @Post("services")
  createService(@Body() body: { name: string; image?: string }) {
    return this.adminService.createService(body);
  }

  @Permissions("catalog.manage")
  @Patch("services/:id")
  updateService(@Param("id") id: string, @Body("status") status: boolean) {
    return this.adminService.updateService(id, status);
  }

  @Permissions("catalog.manage")
  @Delete("services/:id")
  deleteService(@Param("id") id: string) {
    return this.adminService.deleteService(id);
  }

  @Permissions("catalog.manage")
  @Get("suggested-services")
  suggestedServices() {
    return this.adminService.getSuggestedServices();
  }

  @Permissions("catalog.manage")
  @Delete("suggested-services/:id")
  deleteSuggestedService(@Param("id") id: string) {
    return this.adminService.deleteSuggestedService(id);
  }

  // ─── Doctor holidays ─────────────────────────────────────
  @Permissions("doctors.manage")
  @Get("doctor-holidays")
  doctorHolidays() {
    return this.adminService.getDoctorHolidays();
  }

  @Permissions("doctors.manage")
  @Post("doctor-holidays")
  createDoctorHoliday(@Body() body: { doctorId: string; date: string }) {
    return this.adminService.createDoctorHoliday(body);
  }

  @Permissions("doctors.manage")
  @Delete("doctor-holidays/:id")
  deleteDoctorHoliday(@Param("id") id: string) {
    return this.adminService.deleteDoctorHoliday(id);
  }

  // ─── Attendance & recharges ──────────────────────────────
  @Permissions("finance.view")
  @Get("attendance")
  attendance(@Query("date") date?: string) {
    return this.adminService.getAttendance(date);
  }

  @Permissions("finance.view")
  @Get("recharges")
  recharges(@Query("startDate") s?: string, @Query("endDate") e?: string) {
    return this.adminService.getRecharges(s, e);
  }

  // ─── Withdrawals ─────────────────────────────────────────
  @Permissions("finance.view")
  @Get("withdraw-requests")
  withdrawRequests(@Query("status") status?: string) {
    return this.adminService.getAllWithdrawRequests(status);
  }

  @Permissions("finance.manage")
  @Patch("withdraw-requests/:id")
  async updateWithdrawRequest(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body() body: { status: string; declineReason?: string; payDate?: string },
  ) {
    const r = await this.adminService.updateWithdrawRequest(id, body);
    await this.audit.log(
      admin.sub,
      `withdrawal.${(body.status || "").toLowerCase()}`,
      "withdrawRequest",
      id,
    );
    return r;
  }

  @Permissions("finance.view")
  @Get("transactions")
  transactions(
    @Query("page") page = 1,
    @Query("limit") limit = 25,
    @Query("type") type?: string,
  ) {
    return this.adminService.getTransactions(+page, +limit, type);
  }

  // ─── Coupons ─────────────────────────────────────────────
  @Permissions("coupons.manage")
  @Get("coupons")
  coupons() {
    return this.adminService.getAllCoupons();
  }

  @Permissions("coupons.manage")
  @Post("coupons")
  createCoupon(@Body() body: Record<string, unknown>) {
    return this.adminService.createCoupon(body);
  }

  @Permissions("coupons.manage")
  @Patch("coupons/:id/toggle")
  toggleCoupon(@Param("id") id: string, @Body("isActive") isActive: boolean) {
    return this.adminService.toggleCoupon(id, isActive);
  }

  @Permissions("coupons.manage")
  @Delete("coupons/:id")
  deleteCoupon(@Param("id") id: string) {
    return this.adminService.deleteCoupon(id);
  }

  // ─── Subscriptions (DoctiumPlus) ─────────────────────────
  @Permissions("subscriptions.view")
  @Get("subscription-plans")
  subscriptionPlans() {
    return this.plans.listAllPlans();
  }

  @Permissions("subscriptions.manage")
  @Post("subscription-plans")
  createSubscriptionPlan(@Body() body: CreatePlanDto) {
    return this.plans.createPlan(body);
  }

  @Permissions("subscriptions.manage")
  @Patch("subscription-plans/:id")
  updateSubscriptionPlan(@Param("id") id: string, @Body() body: UpdatePlanDto) {
    return this.plans.updatePlan(id, body);
  }

  @Permissions("subscriptions.manage")
  @Patch("subscription-plans/:id/toggle")
  toggleSubscriptionPlan(
    @Param("id") id: string,
    @Body("isActive") isActive: boolean,
  ) {
    return this.plans.togglePlan(id, isActive);
  }

  @Permissions("subscriptions.manage")
  @Delete("subscription-plans/:id")
  deleteSubscriptionPlan(@Param("id") id: string) {
    return this.plans.deletePlan(id);
  }

  @Permissions("subscriptions.view")
  @Get("subscriptions")
  subscriptions(
    @Query("page") page = 1,
    @Query("limit") limit = 25,
    @Query("status") status?: string,
    @Query("audience") audience?: string,
  ) {
    return this.adminService.getSubscriptions(+page, +limit, status, audience);
  }

  @Permissions("subscriptions.view")
  @Get("subscriptions/revenue")
  subscriptionRevenue() {
    return this.adminService.getSubscriptionRevenue();
  }

  /** Manual trigger for the renewal sweep (ops / testing). */
  @Permissions("subscriptions.manage")
  @Post("subscriptions/run-renewals")
  runRenewals() {
    return this.billing.runRenewals();
  }

  // ─── Banners ─────────────────────────────────────────────
  @Permissions("catalog.manage")
  @Get("banners")
  banners() {
    return this.adminService.getAllBanners();
  }

  @Permissions("catalog.manage")
  @Post("banners")
  createBanner(@Body() body: Record<string, unknown>) {
    return this.adminService.createBanner(body);
  }

  @Permissions("catalog.manage")
  @Patch("banners/:id/toggle")
  toggleBanner(@Param("id") id: string, @Body("isActive") isActive: boolean) {
    return this.adminService.toggleBanner(id, isActive);
  }

  @Permissions("catalog.manage")
  @Delete("banners/:id")
  deleteBanner(@Param("id") id: string) {
    return this.adminService.deleteBanner(id);
  }

  // ─── Prescriptions ───────────────────────────────────────
  @Permissions("content.view")
  @Get("prescriptions")
  prescriptions(@Query("page") page = 1, @Query("limit") limit = 20) {
    return this.adminService.getPrescriptions(+page, +limit);
  }

  @Permissions("content.view")
  @Get("prescriptions/:id")
  prescriptionDetail(@Param("id") id: string) {
    return this.adminService.getPrescriptionDetail(id);
  }
}
