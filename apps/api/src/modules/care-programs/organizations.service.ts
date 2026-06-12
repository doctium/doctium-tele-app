import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { CareProgramsService, VitalConfig } from "./care-programs.service";

const csvCell = (v: unknown): string => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Enterprise layer (Phase 3): organizations (HMOs, employers, health systems)
 * sponsor care-program seats for their member patients. Tracks utilization
 * and produces the outcomes report — the artifact enterprise contracts renew on.
 * Billing is contractual/off-platform; a seat is "used" while a linked
 * enrollment is ACTIVE or PAUSED.
 */
@Injectable()
export class OrganizationsService {
  constructor(private readonly care: CareProgramsService) {}

  // ─── Org CRUD ────────────────────────────────────────────
  list() {
    return prisma.organization
      .findMany({
        include: {
          _count: { select: { members: true, sponsorships: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      .then((orgs) =>
        orgs.map((o) => ({
          ...o,
          memberCount: o._count.members,
          sponsorshipCount: o._count.sponsorships,
        })),
      );
  }

  create(dto: {
    name: string;
    type?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
  }) {
    if (!dto.name?.trim()) throw new BadRequestException("Name is required");
    return prisma.organization.create({
      data: {
        name: dto.name.trim(),
        type: dto.type ?? "",
        contactName: dto.contactName ?? "",
        contactEmail: dto.contactEmail ?? "",
        contactPhone: dto.contactPhone ?? "",
        notes: dto.notes ?? "",
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      type: string;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
      notes: string;
      status: "ACTIVE" | "SUSPENDED";
    }>,
  ) {
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException("Organization not found");
    return prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.type != null ? { type: dto.type } : {}),
        ...(dto.contactName != null ? { contactName: dto.contactName } : {}),
        ...(dto.contactEmail != null ? { contactEmail: dto.contactEmail } : {}),
        ...(dto.contactPhone != null ? { contactPhone: dto.contactPhone } : {}),
        ...(dto.notes != null ? { notes: dto.notes } : {}),
        ...(dto.status === "ACTIVE" || dto.status === "SUSPENDED"
          ? { status: dto.status }
          : {}),
      },
    });
  }

  // ─── Members ─────────────────────────────────────────────
  /** Attach a patient account by email or mobile (how HMOs identify enrollees). */
  async addMember(
    organizationId: string,
    identifier: string,
    externalRef?: string,
  ) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const needle = (identifier ?? "").trim();
    if (!needle) throw new BadRequestException("Provide an email or mobile");
    const user = await prisma.user.findFirst({
      where: {
        isDelete: false,
        OR: [{ email: needle }, { mobile: needle }],
      },
      select: { id: true, name: true, email: true, mobile: true, image: true },
    });
    if (!user)
      throw new NotFoundException(
        "No patient account matches that email/mobile",
      );

    const existing = await prisma.orgMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (existing)
      throw new BadRequestException(
        `${user.name || "That patient"} is already a member`,
      );

    const member = await prisma.orgMember.create({
      data: { organizationId, userId: user.id, externalRef: externalRef ?? "" },
    });
    return { ...member, user };
  }

  async removeMember(organizationId: string, memberId: string) {
    const member = await prisma.orgMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) throw new NotFoundException("Member not found");
    await prisma.orgMember.delete({ where: { id: memberId } });
    return { removed: true };
  }

  // ─── Sponsorships ────────────────────────────────────────
  async upsertSponsorship(
    organizationId: string,
    dto: {
      programId: string;
      seats: number;
      endsAt?: string;
      isActive?: boolean;
    },
  ) {
    const [org, program] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.careProgram.findUnique({ where: { id: dto.programId } }),
    ]);
    if (!org) throw new NotFoundException("Organization not found");
    if (!program) throw new NotFoundException("Program not found");
    const seats = Math.max(1, Math.round(dto.seats || 1));

    return prisma.programSponsorship.upsert({
      where: {
        organizationId_programId: { organizationId, programId: dto.programId },
      },
      create: {
        organizationId,
        programId: dto.programId,
        seats,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
      },
      update: {
        seats,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
      },
      include: { program: { select: { name: true } } },
    });
  }

  // ─── Detail + utilization + outcomes ─────────────────────
  async detail(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                mobile: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        sponsorships: {
          include: {
            program: { select: { id: true, name: true, price: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const sponsorships = await Promise.all(
      org.sponsorships.map(async (s) => ({
        ...s,
        seatsUsed: await prisma.programEnrollment.count({
          where: { sponsorshipId: s.id, status: { in: ["ACTIVE", "PAUSED"] } },
        }),
      })),
    );

    const rows = await this.outcomeRows(id);
    const adherencePcts = rows
      .map((r) => r.adherencePercent)
      .filter((p): p is number => p != null);

    return {
      ...org,
      sponsorships,
      enrollments: rows,
      summary: {
        members: org.members.length,
        sponsoredEnrollments: rows.length,
        avgAdherence: adherencePcts.length
          ? Math.round(
              adherencePcts.reduce((s, p) => s + p, 0) / adherencePcts.length,
            )
          : null,
        openAlerts: rows.reduce((s, r) => s + r.openAlerts, 0),
        goalsAchieved: rows.reduce((s, r) => s + r.goalsAchieved, 0),
      },
    };
  }

  /** One row per sponsored enrollment — the substance of the outcomes report. */
  private async outcomeRows(organizationId: string) {
    const enrollments = await prisma.programEnrollment.findMany({
      where: { sponsorship: { organizationId } },
      include: {
        program: { select: { name: true, vitals: true, genotypeConfig: true } },
        user: { select: { name: true, email: true, mobile: true } },
        subPatient: { select: { name: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 1000,
    });

    const since7d = new Date(Date.now() - 7 * 86_400_000);
    const rows = [];
    for (const e of enrollments) {
      const primary = (
        Array.isArray(e.program.vitals)
          ? (e.program.vitals as VitalConfig[])
          : []
      )[0];
      const [readings7d, first, latest, openAlerts, goalsAchieved] =
        await Promise.all([
          prisma.vitalReading.count({
            where: { enrollmentId: e.id, takenAt: { gte: since7d } },
          }),
          primary
            ? prisma.vitalReading.findFirst({
                where: { enrollmentId: e.id, type: primary.type as never },
                orderBy: { takenAt: "asc" },
              })
            : null,
          primary
            ? prisma.vitalReading.findFirst({
                where: { enrollmentId: e.id, type: primary.type as never },
                orderBy: { takenAt: "desc" },
              })
            : null,
          prisma.vitalAlert.count({
            where: { enrollmentId: e.id, acknowledgedAt: null },
          }),
          prisma.programGoal.count({
            where: { enrollmentId: e.id, status: "ACHIEVED" },
          }),
        ]);

      rows.push({
        enrollmentId: e.id,
        member: e.subPatient?.name ?? e.user.name,
        account: e.user.email || e.user.mobile,
        program: e.program.name,
        status: e.status,
        startedAt: e.startedAt,
        primaryVital: primary?.type ?? null,
        firstReading: first?.value ?? null,
        latestReading: latest?.value ?? null,
        readings7d,
        adherencePercent: this.care.adherenceFor(
          this.care.genotypeVitals(e.program, e.genotype),
          e.thresholds,
          readings7d,
        ).percent,
        openAlerts,
        goalsAchieved,
      });
    }
    return rows;
  }

  /** The downloadable insurer/employer artifact. */
  async outcomesCsv(
    organizationId: string,
  ): Promise<{ name: string; csv: string }> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const rows = await this.outcomeRows(organizationId);

    const header = [
      "Member",
      "Account",
      "Program",
      "Status",
      "Enrolled",
      "Primary vital",
      "First reading",
      "Latest reading",
      "Adherence % (7d)",
      "Open alerts",
      "Goals achieved",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.member,
          r.account,
          r.program,
          r.status,
          r.startedAt.toISOString().slice(0, 10),
          r.primaryVital ?? "",
          r.firstReading ?? "",
          r.latestReading ?? "",
          r.adherencePercent ?? "",
          r.openAlerts,
          r.goalsAchieved,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    return { name: org.name, csv: lines.join("\n") };
  }
}
