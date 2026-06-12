import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { prisma } from "@doctium/database";

const NAVY = "#133157";
const TEAL = "#2CB7A7";
const INK = "#1B2A3A";
const MUTE = "#6B7A8D";

/** Renders a formal A4 referral letter PDF from a referral id. */
@Injectable()
export class ReferralPdfService {
  async build(id: string): Promise<Buffer> {
    const r = await prisma.referral.findUnique({
      where: { id },
      include: {
        referringDoctor: {
          select: { name: true, designation: true, clinicName: true },
        },
        specialist: {
          select: { name: true, designation: true, clinicName: true },
        },
        user: { select: { name: true, gender: true, dob: true, age: true } },
      },
    });
    if (!r) throw new NotFoundException("Referral not found");

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    const done = new Promise<Buffer>((resolve) =>
      doc.on("end", () => resolve(Buffer.concat(chunks))),
    );

    const W = doc.page.width;
    const M = 50;
    const cw = W - M * 2;

    // Header band
    doc.rect(0, 0, W, 88).fill(NAVY);
    doc.rect(0, 88, W, 4).fill(TEAL);
    doc
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("Doctium", M, 28);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#A9C2DA")
      .text("Specialist Referral Letter", M, 54);
    doc
      .fontSize(9)
      .fillColor("#A9C2DA")
      .text(`Ref: ${r.code.slice(-10).toUpperCase()}`, W - M - 200, 34, {
        width: 200,
        align: "right",
      })
      .text(
        `Date: ${r.createdAt.toISOString().slice(0, 10)}`,
        W - M - 200,
        48,
        { width: 200, align: "right" },
      );
    if (r.urgency === "URGENT") {
      doc.roundedRect(W - M - 86, 60, 86, 18, 9).fill("#D92D20");
      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("URGENT", W - M - 86, 65, { width: 86, align: "center" });
    }

    let y = 120;
    const section = (label: string, value: string, big = false) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(MUTE)
        .text(label.toUpperCase(), M, y, { characterSpacing: 0.5 });
      y += 14;
      doc
        .font(big ? "Helvetica-Bold" : "Helvetica")
        .fontSize(big ? 13 : 11)
        .fillColor(INK)
        .text(value || "—", M, y, { width: cw });
      y = doc.y + 14;
    };

    // Parties
    const fromLine = `Dr. ${r.referringDoctor.name}${r.referringDoctor.designation ? `, ${r.referringDoctor.designation}` : ""}${r.referringDoctor.clinicName ? ` · ${r.referringDoctor.clinicName}` : ""}`;
    const toLine = `Dr. ${r.specialist.name}${r.specialist.designation ? `, ${r.specialist.designation}` : ""}${r.specialist.clinicName ? ` · ${r.specialist.clinicName}` : ""}`;
    section("Referring doctor", fromLine);
    section("Referred to", toLine);

    // Patient
    const pid = [r.user.gender, r.user.age ? `${r.user.age} yrs` : r.user.dob]
      .filter(Boolean)
      .join(" · ");
    section("Patient", `${r.user.name}${pid ? `   (${pid})` : ""}`, true);

    // Divider
    doc
      .moveTo(M, y)
      .lineTo(W - M, y)
      .lineWidth(0.7)
      .strokeColor("#E3EAF1")
      .stroke();
    y += 16;

    if (r.reason) section("Reason for referral", r.reason);
    if (r.diagnosis) section("Working diagnosis", r.diagnosis);
    if (r.clinicalSummary) section("Clinical summary", r.clinicalSummary);

    // Footer
    const fy = doc.page.height - 70;
    doc
      .moveTo(M, fy)
      .lineTo(W - M, fy)
      .lineWidth(0.7)
      .strokeColor("#E3EAF1")
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTE)
      .text(
        "This referral was generated electronically by Doctium. The clinical summary is drawn from the patient's medical record at the time of referral.",
        M,
        fy + 10,
        { width: cw, align: "center" },
      );

    doc.end();
    return done;
  }
}
