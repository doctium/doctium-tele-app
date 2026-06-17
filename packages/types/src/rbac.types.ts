// ── RBAC permission catalog (shared by API guards + admin-panel matrix UI) ──

export interface PermissionDef {
  key: string;
  label: string;
}
export interface PermissionGroup {
  group: string;
  permissions: PermissionDef[];
}

/** The full catalog, grouped by area. The role-editor renders this; guards check the keys. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "View dashboard" }],
  },
  {
    group: "Customers",
    permissions: [
      { key: "users.view", label: "View customers" },
      { key: "users.manage", label: "Block / manage customers" },
    ],
  },
  {
    group: "Doctors",
    permissions: [
      { key: "doctors.view", label: "View doctors" },
      { key: "doctors.manage", label: "Manage doctors" },
      { key: "doctors.verify", label: "KYC review & verification" },
    ],
  },
  {
    group: "Appointments",
    permissions: [
      { key: "appointments.view", label: "View appointments" },
      {
        key: "appointments.manage_recordings",
        label: "Manage consultation recordings",
      },
    ],
  },
  {
    group: "Content",
    permissions: [
      { key: "content.view", label: "View prescriptions / reviews" },
      {
        key: "content.moderate",
        label: "Moderate reviews, complaints & MediGram videos",
      },
    ],
  },
  {
    group: "Clinical Records",
    permissions: [
      { key: "emr.view", label: "View patient medical records (EMR)" },
      { key: "emr.export", label: "Export patient records (FHIR)" },
    ],
  },
  {
    group: "Catalog",
    permissions: [
      { key: "catalog.manage", label: "Manage services & banners" },
    ],
  },
  {
    group: "Finance",
    permissions: [
      { key: "finance.view", label: "View transactions & withdrawals" },
      { key: "finance.manage", label: "Approve withdrawals / payouts" },
    ],
  },
  {
    group: "Coupons",
    permissions: [{ key: "coupons.manage", label: "Manage coupons" }],
  },
  {
    group: "Subscriptions",
    permissions: [
      { key: "subscriptions.view", label: "View subscriptions & revenue" },
      { key: "subscriptions.manage", label: "Manage plans & subscriptions" },
    ],
  },
  {
    group: "Settings",
    permissions: [{ key: "settings.manage", label: "Manage settings" }],
  },
  {
    group: "Human Resources",
    permissions: [
      { key: "hr.view", label: "View employees" },
      { key: "hr.manage", label: "Manage employees, departments & leave" },
      { key: "hr.payroll", label: "View & manage salaries / payslips" },
      { key: "hr.roles", label: "Manage roles & permissions" },
    ],
  },
  {
    group: "Communication",
    permissions: [
      { key: "comms.support_view", label: "View support chat" },
      { key: "comms.support_reply", label: "Reply to support messages" },
      { key: "comms.notifications", label: "Send push notifications" },
      { key: "comms.email", label: "Send emails" },
      { key: "comms.sms", label: "Send SMS" },
    ],
  },
  {
    group: "Analytics",
    permissions: [
      {
        key: "analytics.view",
        label: "View business analytics (cohorts, churn, revenue)",
      },
    ],
  },
  {
    group: "Enterprise",
    permissions: [
      { key: "enterprise.view", label: "View organizations & outcome reports" },
      {
        key: "enterprise.manage",
        label: "Manage organizations, members & sponsorships",
      },
    ],
  },
  {
    group: "Audit",
    permissions: [{ key: "audit.view", label: "View audit log" }],
  },
  {
    group: "Website & Media",
    permissions: [
      { key: "media.blog.view", label: "View blog posts" },
      {
        key: "media.blog.manage",
        label: "Create / edit / publish blog posts & categories",
      },
      { key: "media.news.view", label: "View news & press" },
      {
        key: "media.news.manage",
        label: "Create / edit / publish news & press",
      },
      { key: "media.careers.view", label: "View job postings" },
      {
        key: "media.careers.manage",
        label: "Create / edit / publish jobs & teams",
      },
      { key: "media.applications.view", label: "View job applications" },
      {
        key: "media.applications.manage",
        label: "Manage applications (status, notes)",
      },
      { key: "media.landing.manage", label: "Manage SEO landing pages" },
      { key: "media.team.view", label: "View team members" },
      {
        key: "media.team.manage",
        label: "Create / edit / publish team members",
      },
    ],
  },
];

/** Flat list of all permission keys. */
export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

export type Permission = string;
