import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

export interface RxPdfData {
  code: string;
  issuedAt: Date;
  diagnosis: string;
  notes: string;
  doctor: { name: string; designation?: string; mobile?: string; clinicName?: string; signatureImage?: string };
  patient: { name: string; forName?: string };
  items: { drugName: string; dosage: string; frequency: string; duration: string; refills: number; instructions: string }[];
  verifyUrl: string;
}

const NAVY = '#133157';
const NAVY_DEEP = '#0B1B30';
const TEAL = '#2CB7A7';
const INK = '#1F2D3D';
const MUTED = '#6B7B90';
const HAIRLINE = '#E7EDF4';

@Injectable()
export class PdfService {
  async build(data: RxPdfData): Promise<Buffer> {
    const qr = await QRCode.toBuffer(data.verifyUrl, { margin: 0, width: 220, color: { dark: NAVY_DEEP, light: '#FFFFFF' } });

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const W = doc.page.width; // 595.28
    const M = 48;
    const right = W - M;
    const contentW = W - M * 2;

    // ── Header band ───────────────────────────────────────────
    doc.rect(0, 0, W, 96).fill(NAVY);
    doc.rect(0, 96, W, 4).fill(TEAL);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Doctium', M, 30);
    doc.fillColor('#ABC4DE').font('Helvetica').fontSize(10).text('DIGITAL PRESCRIPTION', M, 56, { characterSpacing: 1.5 });
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(9)
      .text(`Rx ID: ${data.code.slice(0, 12).toUpperCase()}`, M, 34, { width: contentW, align: 'right' })
      .fillColor('#ABC4DE')
      .text(`Issued: ${data.issuedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, M, 50, { width: contentW, align: 'right' });

    let y = 124;

    // ── Doctor + Patient row ──────────────────────────────────
    const colW = (contentW - 24) / 2;
    this.label(doc, 'PRESCRIBING DOCTOR', M, y);
    this.label(doc, 'PATIENT', M + colW + 24, y);
    y += 16;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(`Dr. ${data.doctor.name}`, M, y, { width: colW });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(data.patient.forName || data.patient.name, M + colW + 24, y, { width: colW });
    y += 18;
    doc.fillColor(MUTED).font('Helvetica').fontSize(10);
    doc.text([data.doctor.designation, data.doctor.clinicName].filter(Boolean).join(' · ') || '—', M, y, { width: colW });
    const patientSub = data.patient.forName ? `For dependent of ${data.patient.name}` : (data.doctor.mobile ? `Booked under ${data.patient.name}` : '');
    doc.text(patientSub || ' ', M + colW + 24, y, { width: colW });
    y += 34;

    // ── Diagnosis ─────────────────────────────────────────────
    if (data.diagnosis) {
      this.label(doc, 'DIAGNOSIS', M, y);
      y += 15;
      doc.fillColor(INK).font('Helvetica').fontSize(11).text(data.diagnosis, M, y, { width: contentW });
      y = doc.y + 16;
    }

    // ── Rx symbol + medications table ─────────────────────────
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(22).text('℞', M, y);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text('Medications', M + 28, y + 5);
    y += 38;

    // table columns (explicit x/width to satisfy noUncheckedIndexedAccess)
    const cNum = M, cDrug = M + 22, cDose = M + 172, cFreq = M + 242, cDur = M + 337, cRef = M + 417;
    const wNum = 22, wDrug = 150, wDose = 70, wFreq = 95, wDur = 80, wRef = right - cRef;

    doc.rect(M, y, contentW, 22).fill('#EEF3F9');
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8);
    const header: [string, number, number][] = [
      ['#', cNum, wNum], ['MEDICATION', cDrug, wDrug], ['DOSAGE', cDose, wDose],
      ['FREQUENCY', cFreq, wFreq], ['DURATION', cDur, wDur], ['REFILLS', cRef, wRef],
    ];
    header.forEach(([t, x, w]) => doc.text(t, x + 6, y + 7, { width: w - 8, characterSpacing: 0.5 }));
    y += 22;

    data.items.forEach((it, i) => {
      const startY = y;
      doc.fillColor(INK).font('Helvetica').fontSize(10);
      doc.text(String(i + 1), cNum + 6, y + 7, { width: wNum - 8 });
      doc.font('Helvetica-Bold').text(it.drugName || '—', cDrug + 6, y + 7, { width: wDrug - 8 });
      doc.font('Helvetica').fillColor(MUTED);
      doc.text(it.dosage || '—', cDose + 6, y + 7, { width: wDose - 8 });
      doc.text(it.frequency || '—', cFreq + 6, y + 7, { width: wFreq - 8 });
      doc.text(it.duration || '—', cDur + 6, y + 7, { width: wDur - 8 });
      doc.text(String(it.refills ?? 0), cRef + 6, y + 7, { width: wRef - 8 });
      let rowBottom = Math.max(doc.y, startY + 24);
      if (it.instructions) {
        doc.fillColor(TEAL).font('Helvetica-Oblique').fontSize(9)
          .text(`↳ ${it.instructions}`, cDrug + 6, rowBottom + 1, { width: contentW - (cDrug - M) - 12 });
        rowBottom = doc.y + 2;
      }
      y = rowBottom + 6;
      doc.moveTo(M, y - 3).lineTo(right, y - 3).strokeColor(HAIRLINE).lineWidth(1).stroke();
    });

    // ── Notes ─────────────────────────────────────────────────
    if (data.notes) {
      y += 10;
      this.label(doc, 'INSTRUCTIONS / NOTES', M, y);
      y += 15;
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(data.notes, M, y, { width: contentW });
      y = doc.y;
    }

    // ── Footer: signature + verification (pinned near bottom) ──
    const footerY = Math.max(y + 40, doc.page.height - 200);
    doc.moveTo(M, footerY).lineTo(right, footerY).strokeColor(HAIRLINE).lineWidth(1).stroke();

    // signature (left)
    const sigBuf = this.decodeImage(data.doctor.signatureImage);
    if (sigBuf) {
      try { doc.image(sigBuf, M, footerY + 14, { fit: [150, 54] }); } catch { /* ignore bad image */ }
    }
    doc.moveTo(M, footerY + 78).lineTo(M + 180, footerY + 78).strokeColor('#B6C3D4').lineWidth(1).stroke();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(`Dr. ${data.doctor.name}`, M, footerY + 84);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(data.doctor.designation || 'Licensed Practitioner', M, footerY + 98);

    // verification (right)
    const qrX = right - 92;
    doc.image(qr, qrX, footerY + 14, { fit: [92, 92] });
    const sealX = qrX - 168;
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(10).text('✓  Digitally signed & verifiable', sealX, footerY + 18, { width: 160 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text('This prescription carries an Ed25519 digital signature. Scan the QR code to confirm its authenticity.', sealX, footerY + 34, { width: 160 });
    doc.fillColor('#9AA8B8').fontSize(7).text(`ID: ${data.code}`, sealX, footerY + 86, { width: 160 });

    doc.end();
    return done;
  }

  private label(doc: PDFKit.PDFDocument, text: string, x: number, y: number) {
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text(text, x, y, { characterSpacing: 1 });
  }

  private decodeImage(dataUrl?: string): Buffer | null {
    if (!dataUrl) return null;
    const base64 = dataUrl.startsWith('data:') ? dataUrl.split(',')[1] : dataUrl;
    if (!base64) return null;
    try { return Buffer.from(base64, 'base64'); } catch { return null; }
  }
}
