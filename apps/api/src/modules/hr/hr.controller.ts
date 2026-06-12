import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { HrService } from "./hr.service";
import { RbacService } from "./rbac.service";
import { AuditService } from "./audit.service";
import {
  CreateEmployeeDto,
  DepartmentDto,
  LeaveDecisionDto,
  LeaveDto,
  PayslipDto,
  RoleDto,
  SetAccessDto,
  UpdateEmployeeDto,
  UploadEmployeeDocDto,
} from "./dto/hr.dto";

@ApiTags("HR")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Controller("admin/hr")
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  private canSeePay(user: JwtPayload): boolean {
    return (
      !!user.isSuperAdmin || (user.permissions ?? []).includes("hr.payroll")
    );
  }

  // ── Roles & permissions ────────────────────────────────────
  @Permissions("hr.roles")
  @Get("permissions")
  permissions() {
    return this.rbac.permissionCatalog();
  }

  @Permissions("hr.view")
  @Get("roles")
  roles() {
    return this.rbac.listRoles();
  }

  @Permissions("hr.roles")
  @Post("roles")
  async createRole(@CurrentUser() u: JwtPayload, @Body() body: RoleDto) {
    const r = await this.rbac.createRole(body);
    await this.audit.log(u.sub, "role.create", "role", r.id, { name: r.name });
    return r;
  }

  @Permissions("hr.roles")
  @Patch("roles/:id")
  async updateRole(
    @CurrentUser() u: JwtPayload,
    @Param("id") id: string,
    @Body() body: Partial<RoleDto>,
  ) {
    const r = await this.rbac.updateRole(id, body);
    await this.audit.log(u.sub, "role.update", "role", id, {
      permissions: body.permissions,
    });
    return r;
  }

  @Permissions("hr.roles")
  @Delete("roles/:id")
  async deleteRole(@CurrentUser() u: JwtPayload, @Param("id") id: string) {
    const r = await this.rbac.deleteRole(id);
    await this.audit.log(u.sub, "role.delete", "role", id);
    return r;
  }

  // ── Departments ────────────────────────────────────────────
  @Permissions("hr.view")
  @Get("departments")
  departments() {
    return this.hr.listDepartments();
  }

  @Permissions("hr.manage")
  @Post("departments")
  createDepartment(@Body() body: DepartmentDto) {
    return this.hr.createDepartment(body);
  }

  @Permissions("hr.manage")
  @Patch("departments/:id")
  updateDepartment(
    @Param("id") id: string,
    @Body() body: Partial<DepartmentDto>,
  ) {
    return this.hr.updateDepartment(id, body);
  }

  @Permissions("hr.manage")
  @Delete("departments/:id")
  deleteDepartment(@Param("id") id: string) {
    return this.hr.deleteDepartment(id);
  }

  // ── Employees ──────────────────────────────────────────────
  @Permissions("hr.view")
  @Get("employees")
  employees(
    @CurrentUser() u: JwtPayload,
    @Query("search") search?: string,
    @Query("departmentId") departmentId?: string,
    @Query("status") status?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.hr.listEmployees(
      { search, departmentId, status, page: +page, limit: +limit },
      this.canSeePay(u),
    );
  }

  @Permissions("hr.manage")
  @Post("employees")
  async createEmployee(
    @CurrentUser() u: JwtPayload,
    @Body() body: CreateEmployeeDto,
  ) {
    const r = await this.hr.createEmployee(body);
    await this.audit.log(u.sub, "employee.create", "employee", r.id, {
      email: r.email,
    });
    return r;
  }

  @Permissions("hr.view")
  @Get("employees/:id")
  employee(@CurrentUser() u: JwtPayload, @Param("id") id: string) {
    return this.hr.getEmployee(id, this.canSeePay(u));
  }

  @Permissions("hr.manage")
  @Patch("employees/:id")
  async updateEmployee(
    @CurrentUser() u: JwtPayload,
    @Param("id") id: string,
    @Body() body: UpdateEmployeeDto,
  ) {
    const r = await this.hr.updateEmployee(id, body);
    await this.audit.log(u.sub, "employee.update", "employee", id);
    return r;
  }

  @Permissions("hr.manage")
  @Patch("employees/:id/access")
  async setAccess(
    @CurrentUser() u: JwtPayload,
    @Param("id") id: string,
    @Body() body: SetAccessDto,
  ) {
    const r = await this.hr.setAccess(id, body);
    await this.audit.log(u.sub, "employee.access", "employee", id, {
      canLogin: body.canLogin,
      roleId: body.roleId,
      isActive: body.isActive,
      reset: !!body.resetPassword,
    });
    return r;
  }

  @Permissions("hr.manage")
  @Post("employees/:id/documents")
  uploadDoc(@Param("id") id: string, @Body() body: UploadEmployeeDocDto) {
    return this.hr.uploadDocument(id, body);
  }

  @Permissions("hr.manage")
  @Delete("documents/:docId")
  deleteDoc(@Param("docId") docId: string) {
    return this.hr.deleteDocument(docId);
  }

  // ── Payslips (hr.payroll) ──────────────────────────────────
  @Permissions("hr.payroll")
  @Get("employees/:id/payslips")
  payslips(@Param("id") id: string) {
    return this.hr.listPayslips(id);
  }

  @Permissions("hr.payroll")
  @Post("employees/:id/payslips")
  createPayslip(@Param("id") id: string, @Body() body: PayslipDto) {
    return this.hr.createPayslip(id, body);
  }

  @Permissions("hr.payroll")
  @Patch("payslips/:id/paid")
  async markPaid(@CurrentUser() u: JwtPayload, @Param("id") id: string) {
    const r = await this.hr.markPayslipPaid(id);
    await this.audit.log(u.sub, "payslip.paid", "payslip", id);
    return r;
  }

  @Permissions("hr.payroll")
  @Delete("payslips/:id")
  deletePayslip(@Param("id") id: string) {
    return this.hr.deletePayslip(id);
  }

  // ── Leave ──────────────────────────────────────────────────
  @Permissions("hr.view")
  @Get("leave")
  leave(
    @Query("status") status?: string,
    @Query("employeeId") employeeId?: string,
  ) {
    return this.hr.listLeave({ status, employeeId });
  }

  @Permissions("hr.manage")
  @Post("leave")
  createLeave(@Body() body: LeaveDto) {
    return this.hr.createLeave(body);
  }

  @Permissions("hr.manage")
  @Patch("leave/:id/decision")
  async decideLeave(
    @CurrentUser() u: JwtPayload,
    @Param("id") id: string,
    @Body() body: LeaveDecisionDto,
  ) {
    const r = await this.hr.decideLeave(id, body, u.sub);
    await this.audit.log(
      u.sub,
      `leave.${body.status.toLowerCase()}`,
      "leave",
      id,
    );
    return r;
  }

  // ── Audit log ──────────────────────────────────────────────
  @Permissions("audit.view")
  @Get("audit")
  auditLog(
    @Query("actorId") actorId?: string,
    @Query("action") action?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
  ) {
    return this.audit.list({ actorId, action, page: +page, limit: +limit });
  }
}
