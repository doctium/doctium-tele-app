import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@doctium/database";

/**
 * Builds a FHIR R4 `Bundle` (type: collection) from a patient's record.
 * This is the interoperability / data-portability surface — the artifact a
 * hospital or external EHR consumes. Resources mapped:
 *   HealthProfile      → Patient (+ Observation for blood type)
 *   MedicalCondition   → Condition
 *   Allergy            → AllergyIntolerance
 *   Surgery            → Procedure
 *   Immunization       → Immunization
 *   ClinicalNote       → Encounter + ClinicalImpression (+ vital Observations)
 *   MedicalFile        → DocumentReference
 */
@Injectable()
export class FhirService {
  async exportPatient(userId: string, subPatientId?: string) {
    const sp = subPatientId ?? null;
    const account = await prisma.user.findUnique({ where: { id: userId } });
    if (!account) throw new NotFoundException("Patient not found");

    const scoped = { where: { subPatientId: sp } };
    const [
      healthProfile,
      member,
      medicalConditions,
      allergies,
      surgeries,
      immunizations,
      medicalFiles,
      clinicalNotes,
    ] = await Promise.all([
      prisma.healthProfile.findFirst({ where: { userId, subPatientId: sp } }),
      sp ? prisma.subPatient.findUnique({ where: { id: sp } }) : null,
      prisma.medicalCondition.findMany({ where: { userId, ...scoped.where } }),
      prisma.allergy.findMany({ where: { userId, ...scoped.where } }),
      prisma.surgery.findMany({ where: { userId, ...scoped.where } }),
      prisma.immunization.findMany({ where: { userId, ...scoped.where } }),
      prisma.medicalFile.findMany({ where: { userId, ...scoped.where } }),
      prisma.clinicalNote.findMany({
        where: { userId, subPatientId: sp },
        include: { doctor: { select: { name: true } } },
      }),
    ]);

    // Patient identity = the family member when scoped, else the account holder.
    const patientId = sp ?? account.id;
    const user = {
      id: patientId,
      name: member ? member.name : account.name,
      gender: member ? member.gender : account.gender,
      dob: member ? "" : account.dob,
      email: member ? "" : account.email,
      mobile: member ? "" : account.mobile,
      healthProfile,
      medicalConditions,
      allergies,
      surgeries,
      immunizations,
      medicalFiles,
      clinicalNotes,
    };

    const ref = (id: string) => `urn:uuid:${id}`;
    const entries: Array<{
      fullUrl: string;
      resource: Record<string, unknown>;
    }> = [];
    const push = (resource: Record<string, unknown>) =>
      entries.push({ fullUrl: ref(resource.id as string), resource });

    // ── Patient ──
    push({
      resourceType: "Patient",
      id: user.id,
      identifier: [{ system: "https://doctium.app/patient", value: user.id }],
      name: [{ text: user.name || "Unknown" }],
      telecom: [
        ...(user.email ? [{ system: "email", value: user.email }] : []),
        ...(user.mobile ? [{ system: "phone", value: user.mobile }] : []),
      ],
      gender: (user.gender || "unknown").toLowerCase(),
      birthDate: user.dob || undefined,
    });
    const subject = { reference: ref(user.id) };

    // ── Blood type → Observation ──
    if (user.healthProfile?.bloodType) {
      push({
        resourceType: "Observation",
        id: `bloodtype-${user.id}`,
        status: "final",
        category: [
          {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "883-9",
              display: "ABO and Rh group",
            },
          ],
          text: "Blood type",
        },
        subject,
        valueString: user.healthProfile.bloodType,
      });
    }

    // ── Conditions ──
    for (const c of user.medicalConditions) {
      push({
        resourceType: "Condition",
        id: c.id,
        clinicalStatus: {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: c.status.toLowerCase(),
            },
          ],
        },
        code: { text: c.name },
        subject,
        onsetString: c.onsetDate || undefined,
        note: c.notes ? [{ text: c.notes }] : undefined,
        recordedDate: c.createdAt.toISOString(),
      });
    }

    // ── Allergies ──
    for (const a of user.allergies) {
      const sev = {
        MILD: "mild",
        MODERATE: "moderate",
        SEVERE: "severe",
        UNKNOWN: undefined,
      }[a.severity];
      push({
        resourceType: "AllergyIntolerance",
        id: a.id,
        clinicalStatus: {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
              code: "active",
            },
          ],
        },
        code: { text: a.substance },
        patient: subject,
        reaction: a.reaction
          ? [{ manifestation: [{ text: a.reaction }], severity: sev }]
          : undefined,
        recordedDate: a.createdAt.toISOString(),
      });
    }

    // ── Surgeries → Procedure ──
    for (const s of user.surgeries) {
      push({
        resourceType: "Procedure",
        id: s.id,
        status: "completed",
        code: { text: s.name },
        subject,
        performedString: s.performedDate || undefined,
        note: [
          s.hospital && { text: `Facility: ${s.hospital}` },
          s.notes && { text: s.notes },
        ].filter(Boolean),
      });
    }

    // ── Immunizations ──
    for (const im of user.immunizations) {
      push({
        resourceType: "Immunization",
        id: im.id,
        status: "completed",
        vaccineCode: { text: im.vaccine },
        patient: subject,
        occurrenceString: im.dateGiven || undefined,
        note: [
          im.doseLabel && { text: im.doseLabel },
          im.notes && { text: im.notes },
        ].filter(Boolean),
      });
    }

    // ── Clinical notes → Encounter + ClinicalImpression + vital Observations ──
    for (const n of user.clinicalNotes) {
      push({
        resourceType: "Encounter",
        id: `enc-${n.id}`,
        status: "finished",
        class: { code: "VR", display: "virtual" },
        subject,
        period: { start: n.createdAt.toISOString() },
      });
      push({
        resourceType: "ClinicalImpression",
        id: n.id,
        status: "completed",
        subject,
        encounter: { reference: ref(`enc-${n.id}`) },
        date: n.createdAt.toISOString(),
        summary: [
          n.subjective && `S: ${n.subjective}`,
          n.objective && `O: ${n.objective}`,
          n.assessment && `A: ${n.assessment}`,
          n.plan && `P: ${n.plan}`,
        ]
          .filter(Boolean)
          .join("\n"),
        note: [{ text: `Recorded by Dr. ${n.doctor?.name ?? "—"}` }],
      });
      const vitals: Array<[string, unknown, string]> = [
        ["Blood pressure", n.bloodPressure, "85354-9"],
        ["Heart rate", n.heartRate, "8867-4"],
        ["Body temperature", n.temperature, "8310-5"],
        ["Respiratory rate", n.respiratoryRate, "9279-1"],
        ["Oxygen saturation", n.oxygenSat, "59408-5"],
        ["Body weight", n.weightKg, "29463-7"],
        ["Body height", n.heightCm, "8302-2"],
      ];
      for (const [label, value, loinc] of vitals) {
        if (value === null || value === undefined || value === "") continue;
        push({
          resourceType: "Observation",
          id: `vital-${n.id}-${loinc}`,
          status: "final",
          category: [
            {
              coding: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "vital-signs",
                },
              ],
            },
          ],
          code: {
            coding: [
              { system: "http://loinc.org", code: loinc, display: label },
            ],
            text: label,
          },
          subject,
          encounter: { reference: ref(`enc-${n.id}`) },
          effectiveDateTime: n.createdAt.toISOString(),
          ...(typeof value === "number"
            ? { valueQuantity: { value } }
            : { valueString: String(value) }),
        });
      }
    }

    // ── Files → DocumentReference ──
    for (const f of user.medicalFiles) {
      push({
        resourceType: "DocumentReference",
        id: f.id,
        status: "current",
        type: { text: f.category },
        subject,
        date: f.createdAt.toISOString(),
        description: f.description || f.fileName,
        content: [
          {
            attachment: {
              contentType: f.mimeType || undefined,
              url: f.fileUrl,
              title: f.fileName,
            },
          },
        ],
      });
    }

    return {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries,
    };
  }
}
