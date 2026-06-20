import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { prisma } from "@doctium/database";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { MailerProvider } from "../notifications/channels/mailer.provider";
import { resolveImageUrl } from "../../common/image.util";
import {
  CreateEmployeeDto,
  DepartmentDto,
  LeaveDecisionDto,
  LeaveDto,
  PayslipDto,
  SetAccessDto,
  UpdateEmployeeDto,
  UploadEmployeeDocDto,
} from "./dto/hr.dto";

type EmployeeRow = Record<string, unknown> & {
  password?: string | null;
  salary?: number;
  currency?: string;
  payCycle?: string;
};

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

@Injectable()
export class HrService {
  constructor(
    private readonly cloudinary: CloudinaryService,
    private readonly mailer: MailerProvider,
  ) {}

  /** Never leak password hashes; hide compensation unless the caller has hr.payroll. */
  private sanitize<T extends EmployeeRow>(
    emp: T,
    canSeePay: boolean,
  ): Partial<T> {
    const { password: _password, ...rest } = emp;
    if (!canSeePay) {
      delete (rest as EmployeeRow).salary;
      delete (rest as EmployeeRow).currency;
      delete (rest as EmployeeRow).payCycle;
    }
    return rest as Partial<T>;
  }

  private tempPassword() {
    return Math.random().toString(36).slice(2, 10) + "A1";
  }

  /**
   * Fire-and-forget welcome email with login credentials + panel URL.
   * No-ops gracefully unless the mailer is configured. Never blocks or throws
   * the create flow.
   */
  private sendWelcomeEmail(name: string, email: string, password: string) {
    if (!email || !password || !this.mailer.isConfigured()) return;
    const adminUrl = process.env.ADMIN_PANEL_URL || "http://localhost:3000";
    const loginUrl = `${adminUrl}/login`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #E6ECF3;border-radius:14px">
        <h2 style="color:#133157;margin:0 0 6px">Welcome to Doctium</h2>
        <p style="color:#5A6B82;margin:0 0 18px">Hi ${escapeHtml(name) || "there"}, an account has been created for you on the Doctium admin panel. Use the credentials below to sign in.</p>
        <table style="width:100%;font-size:14px;color:#0F1B2D">
          <tr><td style="padding:6px 0;color:#93A1B5">Email</td><td style="text-align:right;font-weight:bold">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:6px 0;color:#93A1B5">Temporary password</td><td style="text-align:right;font-weight:bold">${escapeHtml(password)}</td></tr>
        </table>
        <a href="${loginUrl}" style="display:block;text-align:center;background:#133157;color:#fff;text-decoration:none;padding:12px;border-radius:10px;margin-top:18px;font-weight:bold">Sign in to Doctium</a>
        <p style="color:#5A6B82;font-size:13px;margin:18px 0 0">For your security, please change your password after your first login — open your profile menu (top-right) and choose <strong>Profile</strong> to update it.</p>
      </div>`;
    void this.mailer
      .sendEmail(email, "Your Doctium admin account is ready", html)
      .catch(() => undefined);
  }

  // ── Employees ──────────────────────────────────────────────
  async listEmployees(
    q: {
      search?: string;
      departmentId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
    canSeePay: boolean,
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (q.departmentId) where.departmentId = q.departmentId;
    if (q.status) where.status = q.status as never;
    if (q.search)
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
        { position: { contains: q.search, mode: "insensitive" } },
      ];
    const [rows, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: { select: { name: true } },
          role: { select: { name: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.sanitize(r as EmployeeRow, canSeePay)),
      total,
    };
  }

  async getEmployee(id: string, canSeePay: boolean) {
    const emp = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        documents: { orderBy: { createdAt: "desc" } },
        payslips: canSeePay ? { orderBy: { createdAt: "desc" } } : false,
        leaveRequests: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!emp) throw new NotFoundException("Employee not found");
    return this.sanitize(emp as EmployeeRow, canSeePay);
  }

  async createEmployee(dto: CreateEmployeeDto) {
    if (!dto.name?.trim() || !dto.email?.trim())
      throw new BadRequestException("Name and email are required");
    const exists = await prisma.employee.findUnique({
      where: { email: dto.email },
    });
    if (exists)
      throw new BadRequestException(
        "An employee with that email already exists",
      );

    let tempPassword: string | undefined;
    const data: Record<string, unknown> = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? "",
      // Photo: data-URL → Cloudinary (or stored as-is without creds).
      image: await resolveImageUrl(
        this.cloudinary,
        dto.image,
        `employee-${dto.email.replace(/[^a-z0-9]/gi, "_")}`,
      ),
      gender: dto.gender ?? "",
      dob: dto.dob ?? "",
      address: dto.address ?? "",
      emergencyName: dto.emergencyName ?? "",
      emergencyPhone: dto.emergencyPhone ?? "",
      position: dto.position ?? "",
      ...(dto.employmentType && {
        employmentType: dto.employmentType as never,
      }),
      ...(dto.status && { status: dto.status as never }),
      ...(dto.hireDate && { hireDate: new Date(dto.hireDate) }),
      ...(dto.departmentId && { departmentId: dto.departmentId }),
      ...(dto.managerId && { managerId: dto.managerId }),
      salary: Number(dto.salary) || 0,
      currency: dto.currency ?? "NGN",
      ...(dto.payCycle && { payCycle: dto.payCycle as never }),
    };
    if (dto.canLogin) {
      tempPassword = dto.password || this.tempPassword();
      data.canLogin = true;
      data.password = await bcrypt.hash(tempPassword, 12);
      data.roleId = dto.roleId ?? null;
      data.isActive = true;
    }
    const emp = await prisma.employee.create({ data: data as never });
    // Email the new hire their credentials + login URL (only if they can log in).
    if (dto.canLogin && tempPassword)
      this.sendWelcomeEmail(emp.name, emp.email, tempPassword);
    return {
      id: emp.id,
      email: emp.email,
      tempPassword: dto.password ? undefined : tempPassword,
    };
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const data: Record<string, unknown> = {};
    const fields: (keyof UpdateEmployeeDto)[] = [
      "name",
      "phone",
      "gender",
      "dob",
      "address",
      "emergencyName",
      "emergencyPhone",
      "position",
    ];
    for (const f of fields) if (dto[f] !== undefined) data[f] = dto[f];
    if (dto.image !== undefined)
      data.image = await resolveImageUrl(
        this.cloudinary,
        dto.image,
        `employee-${id}`,
      );
    if (dto.employmentType !== undefined)
      data.employmentType = dto.employmentType as never;
    if (dto.status !== undefined) data.status = dto.status as never;
    if (dto.hireDate !== undefined)
      data.hireDate = dto.hireDate ? new Date(dto.hireDate) : null;
    if (dto.departmentId !== undefined)
      data.departmentId = dto.departmentId || null;
    if (dto.managerId !== undefined) data.managerId = dto.managerId || null;
    if (dto.salary !== undefined) data.salary = Number(dto.salary) || 0;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.payCycle !== undefined) data.payCycle = dto.payCycle as never;
    await prisma.employee.update({ where: { id }, data: data as never });
    return { updated: true };
  }

  /** Grant/revoke panel login, set role, enable/disable, or reset password. Returns a temp password if reset. */
  async setAccess(id: string, dto: SetAccessDto) {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException("Employee not found");
    if (emp.isSuperAdmin && dto.isActive === false)
      throw new BadRequestException("The super-admin cannot be disabled");

    const data: Record<string, unknown> = {};
    if (dto.canLogin !== undefined) data.canLogin = dto.canLogin;
    if (dto.roleId !== undefined) data.roleId = dto.roleId || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    let tempPassword: string | undefined;
    if (dto.resetPassword) {
      tempPassword = this.tempPassword();
      data.password = await bcrypt.hash(tempPassword, 12);
      data.canLogin = true;
    }
    await prisma.employee.update({ where: { id }, data: data as never });
    return { updated: true, tempPassword };
  }

  // ── Departments ────────────────────────────────────────────
  listDepartments() {
    return prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    });
  }
  createDepartment(dto: DepartmentDto) {
    if (!dto.name?.trim())
      throw new BadRequestException("Department name is required");
    return prisma.department.create({
      data: { name: dto.name.trim(), description: dto.description ?? "" },
    });
  }
  updateDepartment(id: string, dto: Partial<DepartmentDto>) {
    return prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }
  async deleteDepartment(id: string) {
    const count = await prisma.employee.count({ where: { departmentId: id } });
    if (count > 0)
      throw new BadRequestException(
        "Department has employees — reassign them first",
      );
    await prisma.department.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Employment documents ───────────────────────────────────
  async uploadDocument(employeeId: string, dto: UploadEmployeeDocDto) {
    if (!dto?.dataUrl || !dto?.type)
      throw new BadRequestException("Document type and file are required");
    if (!this.cloudinary.isConfigured())
      throw new BadRequestException("Document storage is not configured");
    const url = await this.cloudinary.uploadDataUrl(
      dto.dataUrl,
      `hr/${employeeId}/${dto.type}_${Date.now()}`,
    );
    if (!url) throw new BadRequestException("Upload failed, please try again");
    return prisma.employeeDocument.create({
      data: {
        employeeId,
        type: dto.type as never,
        fileUrl: url,
        fileName: dto.fileName ?? "",
        mimeType: dto.mimeType ?? "",
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }
  async deleteDocument(docId: string) {
    await prisma.employeeDocument.delete({ where: { id: docId } });
    return { deleted: true };
  }

  // ── Payslips (records only — no money movement) ────────────
  listPayslips(employeeId: string) {
    return prisma.payslip.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });
  }
  async createPayslip(employeeId: string, dto: PayslipDto) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { salary: true, currency: true },
    });
    if (!emp) throw new NotFoundException("Employee not found");
    const gross = dto.gross !== undefined ? Number(dto.gross) : emp.salary;
    const deductions = Number(dto.deductions) || 0;
    return prisma.payslip.create({
      data: {
        employeeId,
        periodLabel: dto.periodLabel,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        gross,
        deductions,
        net: Math.max(0, gross - deductions),
        currency: emp.currency,
        notes: dto.notes ?? "",
      },
    });
  }
  markPayslipPaid(id: string) {
    return prisma.payslip.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });
  }
  async deletePayslip(id: string) {
    await prisma.payslip.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Leave ──────────────────────────────────────────────────
  listLeave(q: { status?: string; employeeId?: string }) {
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status as never;
    if (q.employeeId) where.employeeId = q.employeeId;
    return prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: { id: true, name: true, image: true, leaveBalance: true },
        },
      },
    });
  }
  async createLeave(dto: LeaveDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const days = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
    );
    return prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        type: (dto.type ?? "ANNUAL") as never,
        startDate: start,
        endDate: end,
        days,
        reason: dto.reason ?? "",
      },
    });
  }
  async decideLeave(id: string, dto: LeaveDecisionDto, deciderId: string) {
    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException("Leave request not found");
    if (leave.status !== "PENDING")
      throw new BadRequestException("This request has already been decided");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: dto.status as never,
          decidedById: deciderId,
          decidedAt: new Date(),
          decisionNote: dto.note ?? "",
        },
      });
      // On approval, draw down the annual-leave balance (paid leave types only).
      if (
        dto.status === "APPROVED" &&
        ["ANNUAL", "SICK"].includes(leave.type)
      ) {
        await tx.employee.update({
          where: { id: leave.employeeId },
          data: { leaveBalance: { decrement: leave.days } },
        });
      }
      return updated;
    });
  }
}
