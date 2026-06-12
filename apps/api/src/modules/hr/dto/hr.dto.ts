export interface CreateEmployeeDto {
  name: string;
  email: string;
  phone?: string;
  /** Profile photo as a data URL (≤1MB enforced client-side) or existing URL. */
  image?: string;
  gender?: string;
  dob?: string;
  address?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  position?: string;
  employmentType?: string; // EmploymentType
  status?: string; // EmployeeStatus
  hireDate?: string;
  departmentId?: string;
  managerId?: string;
  // Compensation (hr.payroll)
  salary?: number;
  currency?: string;
  payCycle?: string; // PayCycle
  // Access / RBAC
  canLogin?: boolean;
  password?: string; // optional; a temp password is generated if canLogin && omitted
  roleId?: string;
}

export type UpdateEmployeeDto = Partial<CreateEmployeeDto>;

export interface SetAccessDto {
  canLogin?: boolean;
  roleId?: string | null;
  isActive?: boolean;
  resetPassword?: boolean; // generate + return a new temp password
}

export interface RoleDto {
  name: string;
  description?: string;
  permissions?: string[];
}

export interface DepartmentDto {
  name: string;
  description?: string;
}

export interface UploadEmployeeDocDto {
  type: string; // EmployeeDocType
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
  expiresAt?: string;
}

export interface PayslipDto {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  gross?: number; // defaults to the employee's salary
  deductions?: number;
  notes?: string;
}

export interface LeaveDto {
  employeeId: string;
  type?: string; // LeaveType
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface LeaveDecisionDto {
  status: "APPROVED" | "REJECTED";
  note?: string;
}
