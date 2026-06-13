import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { LlmProvider } from "../triage/llm.provider";
import { EntitlementsService } from "../subscriptions/entitlements.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AudioExtractorService } from "./audio-extractor.service";

export interface SoapDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface ScribeRxItem {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface ScribeSuggestions {
  prescriptionItems: ScribeRxItem[];
  referral: { specialty: string; reason: string } | null;
  recallDays: number | null;
  conditions: string[];
  allergies: { substance: string; reaction: string }[];
  program: { id: string; name: string; condition: string } | null;
}

interface ScribeCompletion extends SoapDraft {
  prescriptionItems: ScribeRxItem[];
  referral: { specialty: string; reason: string } | null;
  recallDays: number | null;
  conditions: string[];
  allergies: { substance: string; reaction: string }[];
}

/** Strict structured output — the model cannot reply off-schema. */
const SCRIBE_SCHEMA = {
  name: "scribe_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      subjective: { type: "string" },
      objective: { type: "string" },
      assessment: { type: "string" },
      plan: { type: "string" },
      prescriptionItems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            drugName: { type: "string" },
            dosage: { type: "string" },
            frequency: { type: "string" },
            duration: { type: "string" },
            instructions: { type: "string" },
          },
          required: [
            "drugName",
            "dosage",
            "frequency",
            "duration",
            "instructions",
          ],
        },
      },
      referral: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          specialty: { type: "string" },
          reason: { type: "string" },
        },
        required: ["specialty", "reason"],
      },
      recallDays: { type: ["integer", "null"] },
      conditions: { type: "array", items: { type: "string" } },
      allergies: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            substance: { type: "string" },
            reaction: { type: "string" },
          },
          required: ["substance", "reaction"],
        },
      },
    },
    required: [
      "subjective",
      "objective",
      "assessment",
      "plan",
      "prescriptionItems",
      "referral",
      "recallDays",
      "conditions",
      "allergies",
    ],
  },
} as const;

const SYSTEM_PROMPT = `You are a clinical scribe assisting a licensed doctor on a telemedicine platform. Draft a SOAP note from the consultation source text provided, and extract suggested follow-up actions.

SOAP rules:
- Use ONLY information actually present in the source text. Never invent symptoms, examination findings, vitals, diagnoses, medications, doses, or follow-up instructions.
- Subjective: the patient's reported symptoms, history and concerns, in standard clinical phrasing ("Patient reports...").
- Objective: observable/measured findings only. Telemedicine consults rarely have an examination — if none is described, return an empty string. Patient-reported measurements (e.g. home BP readings) belong here only when explicitly stated.
- Assessment: the doctor's stated working diagnosis or impression. If the doctor did not state one, summarise the presenting problem without inventing a diagnosis.
- Plan: treatment, prescriptions, investigations, referrals and follow-up actually discussed. Empty string if none.
- Be concise and professional. No markdown, no headings inside the fields, no preamble.

Action extraction rules — extract ONLY what the doctor explicitly stated in the source; when unsure, leave it out:
- prescriptionItems: medications the doctor said they will prescribe or told the patient to take, with dosage/frequency/duration/instructions exactly as stated (empty string for anything not stated). Empty array if none.
- referral: ONLY if the doctor said they will refer the patient or that the patient must see a specialist — {specialty, reason}. Otherwise null.
- recallDays: ONLY if the doctor told the patient to return or be reviewed after a specific period — convert it to days (e.g. "two weeks" = 14). Conditional advice like "come back if it worsens" is NOT a recall. Otherwise null.
- conditions: diagnoses the doctor actually stated (e.g. "tension-type headache"), suitable for the patient's problem list. Empty array if none.
- allergies: allergies the PATIENT clearly reported having ({substance, reaction}; reaction may be empty string). Empty array if none.

This is a DRAFT the doctor will review — every suggested action requires the doctor's explicit confirmation before anything happens.`;

// Bound what we feed the model / store for audit so a marathon chat can't blow up tokens.
const MAX_SOURCE_CHARS = 12_000;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
// Whisper's upload ceiling is 25MB — leave headroom for consult recordings.
const MAX_RECORDING_BYTES = 24 * 1024 * 1024;
// Above this we won't even attempt audio extraction (runaway ffmpeg guard).
const MAX_EXTRACTION_INPUT_BYTES = 1024 * 1024 * 1024; // 1GB

/**
 * Doctium Scribe: drafts a SOAP note from the consult chat thread or a
 * post-visit voice dictation, plus suggested follow-up actions (Phase 2 action
 * hub: Rx items, referral, recall, problem-list entries, care-program match).
 * Never writes SOAP text itself — the doctor reviews the draft in the editor
 * and saves through the normal upsert; every suggested action goes through the
 * existing confirm flows. Only provenance + suggestions are persisted here,
 * server-side, so every AI-assisted note is auditable.
 */
@Injectable()
export class ScribeService {
  constructor(
    private readonly llm: LlmProvider,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly audioExtractor: AudioExtractorService,
  ) {}

  /** Beta switch: while "true" (or unset), every doctor gets the scribe; flip to "false" to make it plan-gated. */
  private async betaForAll(): Promise<boolean> {
    const row = await prisma.setting.findUnique({
      where: { key: "ai_scribe_beta_for_all" },
    });
    return row ? row.value === "true" : true;
  }

  private async loadOwnedAppointment(doctorId: string, appointmentId: string) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        doctorId: true,
        userId: true,
        subPatientId: true,
        user: { select: { name: true, age: true, gender: true } },
        subPatient: { select: { name: true, age: true, gender: true } },
      },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (appt.doctorId !== doctorId) {
      throw new ForbiddenException("Not your appointment");
    }
    return appt;
  }

  async draftNote(
    doctorId: string,
    appointmentId: string,
    dto: { source?: string; audio?: string; mimeType?: string },
  ) {
    const appt = await this.loadOwnedAppointment(doctorId, appointmentId);

    if (!(await this.betaForAll())) {
      const ent = await this.entitlements.resolveDoctorEntitlements(doctorId);
      if (!ent.aiScribe) {
        throw new ForbiddenException(
          "The AI scribe is a premium plan feature. Upgrade your plan to use it.",
        );
      }
    }
    if (!this.llm.enabled) {
      throw new BadRequestException("AI drafting is unavailable right now.");
    }

    const source =
      dto.source === "dictation"
        ? "DICTATION"
        : dto.source === "recording"
          ? "RECORDING"
          : "CHAT";
    const sourceText =
      source === "DICTATION"
        ? await this.transcribeDictation(dto.audio, dto.mimeType)
        : source === "RECORDING"
          ? await this.transcribeRecording(appointmentId, doctorId)
          : await this.buildChatTranscript(appointmentId);

    // Patient context helps phrasing ("34-year-old male") without leaking
    // anything the doctor can't already see on the appointment.
    const patient = appt.subPatient ?? appt.user;
    const context = [
      patient?.name ? `Patient: ${patient.name}` : null,
      patient?.age ? `Age: ${patient.age}` : null,
      patient?.gender ? `Gender: ${patient.gender}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const completion = await this.llm.structured<ScribeCompletion>(
      SYSTEM_PROMPT,
      [
        {
          role: "user",
          content: `${context ? `${context}\n\n` : ""}Consultation ${
            source === "DICTATION" ? "dictation" : "chat transcript"
          }:\n\n${sourceText.slice(0, MAX_SOURCE_CHARS)}`,
        },
      ],
      SCRIBE_SCHEMA,
      { maxTokens: 1600 },
    );

    const draft: SoapDraft = {
      subjective: completion.subjective,
      objective: completion.objective,
      assessment: completion.assessment,
      plan: completion.plan,
    };
    const suggestions: ScribeSuggestions = {
      prescriptionItems: completion.prescriptionItems ?? [],
      referral: completion.referral ?? null,
      recallDays: completion.recallDays ?? null,
      conditions: completion.conditions ?? [],
      allergies: completion.allergies ?? [],
      // Deterministic care-program match on the consult's own words (Leenah
      // pattern) — never an LLM guess, skips programs already enrolled in.
      program: await this.matchProgram(
        appt.userId,
        appt.subPatientId,
        sourceText,
      ),
    };

    // Server-side provenance: record that an AI draft was produced, what it was
    // produced FROM, and the suggested actions. SOAP text is never written here
    // — the doctor applies the draft in the editor and saves through the normal
    // upsert; suggestions only act via the existing doctor-confirmed flows.
    const provenance = {
      aiDrafted: true,
      aiDraftSource: source,
      aiTranscript: sourceText.slice(0, MAX_SOURCE_CHARS),
      aiSuggestions: suggestions as object,
    };
    await prisma.clinicalNote.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        doctorId,
        userId: appt.userId,
        subPatientId: appt.subPatientId,
        ...provenance,
      },
      update: provenance,
    });

    return {
      draft,
      suggestions,
      transcript: sourceText,
      source,
      patient: { userId: appt.userId, subPatientId: appt.subPatientId },
    };
  }

  /**
   * Action-hub chip: the doctor recommends a care program to the patient.
   * Sends an in-app/push notification in the patient's preferred language —
   * enrollment stays entirely the patient's choice.
   */
  async suggestProgram(
    doctorId: string,
    appointmentId: string,
    programId: string,
  ) {
    const appt = await this.loadOwnedAppointment(doctorId, appointmentId);

    const program = await prisma.careProgram.findFirst({
      where: { id: programId, isActive: true },
      select: { id: true, name: true, condition: true },
    });
    if (!program) throw new NotFoundException("Care program not found");

    const enrolled = await prisma.programEnrollment.findFirst({
      where: {
        programId,
        userId: appt.userId,
        subPatientId: appt.subPatientId,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      select: { id: true },
    });
    if (enrolled) {
      throw new BadRequestException(
        "The patient is already enrolled in this program.",
      );
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { name: true },
    });
    await this.notifications.notifyUser(appt.userId, {
      key: "care.doctorSuggestedProgram",
      params: {
        doctor: doctor?.name ?? "Your doctor",
        program: program.name,
        condition: program.condition || program.name,
      },
      type: "care_program_suggested",
    });

    return { suggested: true, program: program.name };
  }

  /** Mirror of Leenah's deterministic suggestKeywords matcher, scoped to this patient. */
  private async matchProgram(
    userId: string,
    subPatientId: string | null,
    haystack: string,
  ) {
    const [programs, enrolled] = await Promise.all([
      prisma.careProgram.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          condition: true,
          suggestKeywords: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.programEnrollment.findMany({
        where: { userId, subPatientId, status: { in: ["ACTIVE", "PAUSED"] } },
        select: { programId: true },
      }),
    ]);
    const enrolledSet = new Set(enrolled.map((e) => e.programId));
    const hay = haystack.toLowerCase();
    for (const p of programs) {
      if (enrolledSet.has(p.id)) continue;
      const keywords = Array.isArray(p.suggestKeywords)
        ? (p.suggestKeywords as unknown[])
        : [];
      const hit = keywords.some(
        (k) => typeof k === "string" && k && hay.includes(k.toLowerCase()),
      );
      if (hit) return { id: p.id, name: p.name, condition: p.condition };
    }
    return null;
  }

  /** The consult's chat thread flattened to "Doctor:/Patient:" lines. */
  private async buildChatTranscript(appointmentId: string): Promise<string> {
    const topics = await prisma.chatTopic.findMany({
      where: { appointmentId },
      include: { chats: { orderBy: { createdAt: "asc" } } },
    });
    const lines = topics
      .flatMap((t) => t.chats)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => {
        const who = m.role === "user" ? "Patient" : "Doctor";
        if (m.messageType === "TEXT" && m.message.trim()) {
          return `${who}: ${m.message.trim()}`;
        }
        if (m.image) return `${who}: [shared an image]`;
        if (m.video) return `${who}: [shared a video]`;
        return null;
      })
      .filter(Boolean) as string[];

    const text = lines.join("\n");
    if (text.length < 40) {
      throw new BadRequestException(
        "There isn't enough conversation on this appointment to draft from yet.",
      );
    }
    return text;
  }

  /**
   * Ambient scribe (Phase 6): transcribe the consented consult recording.
   * Hard gates: both-party consent must be CONSENTED, an AVAILABLE asset must
   * exist, and every AI access is written to the recording access log.
   */
  private async transcribeRecording(
    appointmentId: string,
    doctorId: string,
  ): Promise<string> {
    const consent = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId },
      select: { status: true },
    });
    if (!consent || consent.status !== "CONSENTED") {
      throw new BadRequestException(
        "This consult has no recording consent from both parties.",
      );
    }
    const asset = await prisma.appointmentRecordingAsset.findFirst({
      where: { appointmentId, status: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
      select: { id: true, providerUrl: true, mimeType: true, sizeBytes: true },
    });
    if (!asset?.providerUrl) {
      throw new BadRequestException(
        "No recording is available for this appointment yet.",
      );
    }
    const knownSize = asset.sizeBytes != null ? Number(asset.sizeBytes) : null;
    if (knownSize != null && knownSize > MAX_EXTRACTION_INPUT_BYTES) {
      throw new BadRequestException(
        "This recording is too large to process automatically — use dictation instead.",
      );
    }

    let buffer: Buffer;
    let mime = asset.mimeType || "video/mp4";

    if (knownSize != null && knownSize > MAX_RECORDING_BYTES) {
      // Large recording: pull out a compressed mono audio track that clears
      // Whisper's ceiling instead of rejecting the whole consult.
      const audio = await this.extractRecordingAudio(asset.providerUrl);
      if (!audio) {
        throw new BadRequestException(
          "This recording is too large to transcribe automatically — use dictation instead.",
        );
      }
      buffer = audio;
      mime = "audio/mpeg";
    } else {
      // Small/unknown size: download directly.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);
      try {
        const res = await fetch(asset.providerUrl, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`storage ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      } catch {
        throw new BadRequestException(
          "Couldn't fetch the recording from storage — please try again shortly.",
        );
      } finally {
        clearTimeout(timer);
      }
      // Unknown size that turned out to exceed the ceiling → extract & retry.
      if (buffer.length > MAX_RECORDING_BYTES) {
        const audio = await this.extractRecordingAudio(asset.providerUrl);
        if (!audio) {
          throw new BadRequestException(
            "This recording is too large to transcribe automatically — use dictation instead.",
          );
        }
        buffer = audio;
        mime = "audio/mpeg";
      }
    }
    if (buffer.length < 1_000) {
      throw new BadRequestException("The recording appears to be empty.");
    }

    // Compliance: AI access to a consult recording is auditable like playback.
    // Logged only once we actually have audio in hand — never on a failed read.
    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId,
        assetId: asset.id,
        actorRole: "DOCTOR",
        actorId: doctorId,
        action: "AI_SCRIBE_TRANSCRIBE",
      },
    });

    const transcript = (await this.llm.transcribe(buffer, mime, "en")).trim();
    if (transcript.length < 40) {
      throw new BadRequestException(
        "Couldn't make out the consultation audio in this recording.",
      );
    }
    return transcript;
  }

  /**
   * Extract a Whisper-sized audio track from a large recording via ffmpeg.
   * Returns null when extraction isn't possible or the result still exceeds
   * the ceiling (a marathon recording) — the caller then rejects gracefully.
   */
  private async extractRecordingAudio(url: string): Promise<Buffer | null> {
    const audio = await this.audioExtractor.extractAudio(url, {
      timeoutMs: 180_000,
    });
    if (!audio || audio.length > MAX_RECORDING_BYTES) return null;
    return audio;
  }

  /** Post-visit dictation: base64 (or data-URL) audio → Whisper transcript. */
  private async transcribeDictation(
    audio?: string,
    mimeTypeHint = "audio/m4a",
  ): Promise<string> {
    if (!audio) throw new BadRequestException("No audio provided");

    const base64 = audio.includes(",")
      ? audio.slice(audio.indexOf(",") + 1)
      : audio;
    const mime =
      audio.startsWith("data:") && audio.includes(";")
        ? audio.slice(5, audio.indexOf(";")) || mimeTypeHint
        : mimeTypeHint;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length < 1_000) {
      throw new BadRequestException(
        "That recording was too short — try again.",
      );
    }
    if (buffer.length > MAX_AUDIO_BYTES) {
      throw new BadRequestException(
        "Dictation too long — keep it under about three minutes.",
      );
    }

    const transcript = (await this.llm.transcribe(buffer, mime, "en")).trim();
    if (transcript.length < 20) {
      throw new BadRequestException(
        "Couldn't make out the dictation — try again in a quieter spot.",
      );
    }
    return transcript;
  }
}
