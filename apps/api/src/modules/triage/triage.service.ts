import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { EntitlementsService } from "../subscriptions/entitlements.service";
import {
  ChatMessage,
  LlmProvider,
  QaTurn,
  TriageVerdict,
} from "./llm.provider";
import { screenRedFlags } from "./red-flags";

const MAX_TURNS = 8; // triage: user messages before a verdict is forced
const QA_MAX_TURNS = 20; // q&a: conversation length cap
const DAILY_LIMIT = Math.max(
  1,
  parseInt(process.env.TRIAGE_DAILY_LIMIT || "5", 10) || 5,
);

/** The assistant's brand name — single source of truth for prompts + copy. */
export const ASSISTANT_NAME = "Leenah";

const MODES = ["TRIAGE", "QA"] as const;
type Mode = (typeof MODES)[number];

/** Supported reply languages. "auto" mirrors whatever the patient writes in. */
const LANGUAGES: Record<string, string> = {
  auto: "the same language the patient writes in (English, Nigerian Pidgin, Hausa, Yoruba or Igbo)",
  en: "English",
  pcm: "Nigerian Pidgin",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
};
const GENERAL = "General practice";
const URGENCIES = [
  "EMERGENCY",
  "URGENT_CONSULT",
  "CONSULT_24H",
  "ROUTINE",
  "SELF_CARE",
] as const;
type Urgency = (typeof URGENCIES)[number];

const TRIAGE_GREETINGS: Record<string, string> = {
  en: `Hi, I'm ${ASSISTANT_NAME} — Doctium's AI health assistant. I'll ask you a few short questions to help figure out the right care for you.\n\nThis is health guidance, not a diagnosis — and if this is an emergency, please call 112 or go to the nearest hospital now.\n\nSo, what's bothering you today?`,
  pcm: `How far! Na me be ${ASSISTANT_NAME}, Doctium AI health assistant. I go ask you small small questions make we sabi which care go fit you.\n\nNo be doctor diagnosis be this o — if na emergency, abeg call 112 or rush go hospital now now.\n\nOya, wetin dey worry you today?`,
  ha: `Sannu! Ni ce ${ASSISTANT_NAME}, mataimakiyar lafiya ta AI ta Doctium. Zan yi maka 'yan tambayoyi don gano irin kulawar da ta dace da kai.\n\nWannan shawara ce kawai, ba ganewar likita ba — idan gaggawa ce, kira 112 ko je asibiti yanzu.\n\nTo, me ke damunka yau?`,
  yo: `Ẹ n lẹ! Èmi ni ${ASSISTANT_NAME}, olùrànlọ́wọ́ ìlera AI ti Doctium. Màá bi ọ́ ní àwọn ìbéèrè díẹ̀ kí a lè mọ ìtọ́jú tó yẹ ọ́.\n\nÌtọ́sọ́nà ni èyí, kì í ṣe àyẹ̀wò dókítà — bí ó bá jẹ́ pàjáwìrì, pe 112 tàbí lọ sí ilé ìwòsàn báyìí.\n\nKí ló ń ṣe ọ́ lónìí?`,
  ig: `Ndeewo! Aha m bụ ${ASSISTANT_NAME}, onye inyeaka ahụike AI nke Doctium. Aga m ajụ gị ajụjụ ole na ole ka anyị mata nlekọta kwesịrị gị.\n\nNke a bụ ndụmọdụ, ọ bụghị nchọpụta dọkịta — ọ bụrụ ihe mberede, kpọọ 112 ma ọ bụ gaa ụlọ ọgwụ ugbu a.\n\nGịnị na-eme gị taa?`,
};

const QA_GREETINGS: Record<string, string> = {
  en: `Hi, I'm ${ASSISTANT_NAME} — Doctium's AI health assistant. Ask me any general health question — symptoms, conditions, prevention, nutrition.\n\nI can't diagnose you or recommend medicines, and I never replace a doctor. For emergencies, call 112.\n\nWhat would you like to know?`,
  pcm: `How far! Na me be ${ASSISTANT_NAME}, Doctium AI health assistant. Ask me anything about health matter — sickness, prevention, food, anything.\n\nI no fit diagnose you or give you medicine o, and I no dey replace doctor. If na emergency, call 112.\n\nWetin you wan know?`,
  ha: `Sannu! Ni ce ${ASSISTANT_NAME}, mataimakiyar lafiya ta AI ta Doctium. Tambaye ni kowace tambaya game da lafiya — alamun rashin lafiya, rigakafi, abinci.\n\nBa zan iya ganewa ko ba da magani ba, kuma ba na maye gurbin likita. Idan gaggawa ce, kira 112.\n\nMe kake son sani?`,
  yo: `Ẹ n lẹ! Èmi ni ${ASSISTANT_NAME}, olùrànlọ́wọ́ ìlera AI ti Doctium. Bi mí ní ìbéèrè nípa ìlera — àmì àìsàn, ìdènà àrùn, oúnjẹ.\n\nMi ò lè ṣe àyẹ̀wò tàbí fún ọ ní oògùn, èmi kò sì rọ́pò dókítà. Fún pàjáwìrì, pe 112.\n\nKí ni o fẹ́ mọ̀?`,
  ig: `Ndeewo! Aha m bụ ${ASSISTANT_NAME}, onye inyeaka ahụike AI nke Doctium. Jụọ m ajụjụ ọ bụla gbasara ahụike — mgbaàmà, mgbochi ọrịa, nri.\n\nEnweghị m ike ịchọpụta ọrịa ma ọ bụ nye gị ọgwụ, anaghị m anọchi dọkịta. Maka ihe mberede, kpọọ 112.\n\nGịnị ka ị chọrọ ịma?`,
};

const greetingFor = (mode: Mode, language: string) => {
  const table = mode === "QA" ? QA_GREETINGS : TRIAGE_GREETINGS;
  return table[language] ?? table.en!;
};

const EMERGENCY_MSG =
  "Based on what you've described, this could be a medical emergency. Please call 112 (Nigeria's emergency line) or get to the nearest emergency room NOW — don't wait for an online consultation. If someone is with you, ask them to help you get there.";

const CRISIS_MSG =
  "I'm really glad you told me — what you're feeling matters, and you don't have to face it alone. Please reach out right now to someone you trust, call 112, or go to the nearest hospital; they will help you. If you can, stay with someone until you get support. A Doctium doctor can also speak with you today — but if you are in immediate danger, please seek emergency help first.";

const CLOSING: Record<Urgency, string> = {
  EMERGENCY: EMERGENCY_MSG,
  URGENT_CONSULT:
    "You should speak with a doctor right away. Tap below to start an instant consultation now.",
  CONSULT_24H:
    "This needs a doctor's attention soon — please book a consultation within the next 24 hours.",
  ROUTINE:
    "This doesn't look urgent, but it's worth having a doctor take a proper look. Book an appointment at a time that suits you.",
  SELF_CARE:
    "Good news — this looks manageable at home for now. If anything gets worse or doesn't improve in a few days, please book a consultation.",
};

type StoredMessage = { role: "user" | "assistant"; text: string; at: string };

/**
 * AI Symptom Checker & Triage (Phase 1).
 * Safety architecture: the deterministic red-flag engine screens every patient
 * message BEFORE the LLM and ends the session as EMERGENCY on a hit — the
 * model is never consulted and can never de-escalate. Model verdicts are
 * schema-constrained, validated against live specialties, and any failure
 * falls back to the safe default (consult within 24h, General practice).
 */
@Injectable()
export class TriageService {
  private readonly logger = new Logger("Triage");

  constructor(
    private readonly llm: LlmProvider,
    private readonly entitlements: EntitlementsService,
  ) {}

  get enabled() {
    return this.llm.enabled;
  }

  // ─── Specialty grounding ─────────────────────────────────
  /** Only specialties that actually exist on the platform are routable. */
  private async liveSpecialties(): Promise<string[]> {
    const docs = await prisma.doctor.findMany({
      where: { isVerified: true, isBlock: false, isDelete: false },
      select: { designation: true },
      distinct: ["designation"],
    });
    const set = new Set(
      docs.map((d) => d.designation.trim()).filter((d) => d.length > 0),
    );
    set.add(GENERAL);
    return [...set];
  }

  private qaSystemPrompt(specialties: string[], language: string) {
    return [
      `You are ${ASSISTANT_NAME}, Doctium's AI health assistant, answering people in Nigeria.`,
      `If asked who or what you are: you're ${ASSISTANT_NAME}, an AI assistant — not a doctor, nurse or human.`,
      "You answer GENERAL health questions in plain, warm language: symptoms, conditions, prevention, nutrition, healthy habits.",
      "You are NOT a doctor. Never diagnose the person, never recommend, name or dose any medicine (prescription OR over-the-counter), never tell them a condition is ruled out.",
      "If the question needs personal medical advice (their own symptoms, test results, treatment decisions), give safe general context, set suggestConsult=true and pick the most fitting specialty.",
      `specialty, when set, MUST be exactly one of: ${specialties.join(" | ")}. Otherwise null.`,
      "If asked anything dangerous (self-harm methods, drug misuse, harming others) refuse warmly and point them to help (112, a trusted person, or a Doctium doctor).",
      "If the question is not about health, politely say you only handle health questions.",
      "Keep answers under 150 words. No markdown headings.",
      `Reply in ${LANGUAGES[language] ?? LANGUAGES.auto}.`,
    ].join("\n");
  }

  private systemPrompt(
    specialties: string[],
    forceVerdict: boolean,
    language: string,
  ) {
    return [
      `You are ${ASSISTANT_NAME}, Doctium's AI symptom-triage assistant for patients in Nigeria.`,
      `If asked who or what you are: you're ${ASSISTANT_NAME}, an AI assistant — not a doctor, nurse or human.`,
      "You are NOT a doctor. Never diagnose, never name medications or doses, never rule conditions out. You gather information and route the patient to the right care.",
      'Be warm, plain-spoken and brief. Ask ONE focused question at a time (action "ask"). Don\'t repeat questions already answered.',
      "Ask at least 3 questions (duration, severity, associated/red-flag symptoms, relevant history) before any verdict — unless the picture is clearly life-threatening. Give your verdict after 3-6 questions.",
      forceVerdict
        ? 'You MUST output action "verdict" now — no more questions.'
        : "",
      "Urgency levels, with calibration anchors:",
      "- EMERGENCY: clearly life-threatening RIGHT NOW — severe chest pain, stroke signs, severe breathing difficulty, uncontrolled bleeding, unresponsiveness. RARE in chat triage; do not use it for discomfort that is merely concerning.",
      "- URGENT_CONSULT: needs a doctor today within hours — fever ≥ 39.5°C, persistent vomiting, signs of dehydration, severe pain, infant/elderly with worsening symptoms.",
      "- CONSULT_24H: should be seen within a day — moderate fever (38-39°C) with cough, painful urination, persistent diarrhoea, symptoms steadily worsening.",
      "- ROUTINE: book a normal appointment — chronic or stable complaints, mild rashes, long-standing aches, follow-up concerns.",
      "- SELF_CARE: manageable at home — mild cold or cough, mild headache, minor aches lasting a few days in an otherwise-well adult.",
      "Calibration example: a mild fever (~38°C) with a dry cough for two days in a well adult with no breathing difficulty is CONSULT_24H or SELF_CARE — NOT an emergency.",
      "Only when genuinely torn between two ADJACENT levels, pick the more urgent of the two.",
      `specialty MUST be exactly one of: ${specialties.join(" | ")}. If none clearly fits, use "${GENERAL}".`,
      "selfCare: 2-4 simple, safe, non-drug measures (rest, fluids, monitoring). Never include medicines.",
      "summary: 2-4 sentence clinical handoff for the doctor — presenting complaint, duration, key positives/negatives the patient reported. Write it for a clinician.",
      'If the patient asks something unrelated to their health, politely steer back to their symptoms via an "ask".',
      `Reply in ${LANGUAGES[language] ?? LANGUAGES.auto}. The "summary" field is for the doctor — ALWAYS write it in English.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // ─── Status ──────────────────────────────────────────────
  /** Availability + today's usage per mode + the DoctiumPlus unlimited flag. */
  async getStatus(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [ent, counts] = await Promise.all([
      this.entitlements.resolveUserEntitlements(userId),
      prisma.triageSession.groupBy({
        by: ["mode"],
        where: { userId, createdAt: { gte: today } },
        _count: { id: true },
      }),
    ]);
    const used = (mode: string) =>
      counts.find((c) => c.mode === mode)?._count.id ?? 0;
    return {
      enabled: this.enabled,
      dailyLimit: DAILY_LIMIT,
      unlimited: ent.unlimitedTriage,
      used: { TRIAGE: used("TRIAGE"), QA: used("QA") },
    };
  }

  // ─── Sessions ────────────────────────────────────────────
  async startSession(
    userId: string,
    opts: { subPatientId?: string; mode?: string; language?: string } = {},
  ) {
    if (!this.enabled)
      throw new BadRequestException(
        "The symptom checker is temporarily unavailable. Please book a consultation directly.",
      );

    const mode: Mode = (MODES as readonly string[]).includes(opts.mode ?? "")
      ? (opts.mode as Mode)
      : "TRIAGE";
    if (opts.mode && !(MODES as readonly string[]).includes(opts.mode))
      throw new BadRequestException("Invalid mode");
    const language = opts.language ?? "auto";
    if (!LANGUAGES[language]) throw new BadRequestException("Invalid language");

    // Cap per mode, per day — cost + abuse control. DoctiumPlus plans with the
    // `unlimitedTriage` benefit lift the cap entirely.
    const ent = await this.entitlements.resolveUserEntitlements(userId);
    if (!ent.unlimitedTriage) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const usedToday = await prisma.triageSession.count({
        where: { userId, mode, createdAt: { gte: today } },
      });
      if (usedToday >= DAILY_LIMIT)
        throw new BadRequestException(
          mode === "QA"
            ? "You've reached today's question limit. Upgrade to DoctiumPlus for unlimited questions — or book a consultation for anything pressing."
            : "You've reached today's symptom-check limit. Upgrade to DoctiumPlus for unlimited checks — and call 112 for emergencies.",
        );
    }

    if (opts.subPatientId) {
      const member = await prisma.subPatient.findFirst({
        where: { id: opts.subPatientId, userId },
        select: { id: true },
      });
      if (!member) throw new NotFoundException("Family member not found");
    }

    const greeting: StoredMessage = {
      role: "assistant",
      text: greetingFor(mode, language),
      at: new Date().toISOString(),
    };
    return prisma.triageSession.create({
      data: {
        userId,
        subPatientId: opts.subPatientId ?? null,
        mode,
        language,
        messages: [greeting] as never,
      },
    });
  }

  async sendMessage(sessionId: string, userId: string, text: string) {
    const session = await prisma.triageSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId)
      throw new ForbiddenException("Not your session");
    if (session.status !== "ACTIVE")
      throw new BadRequestException("This session is already complete");

    const clean = (text ?? "").trim().slice(0, 1000);
    if (!clean) throw new BadRequestException("Say something first");

    const messages = (session.messages ?? []) as unknown as StoredMessage[];
    messages.push({ role: "user", text: clean, at: new Date().toISOString() });
    const turns = session.turns + 1;

    // 1) Deterministic safety layer — outranks the model, always.
    const flag = screenRedFlags(clean);
    if (flag) {
      const reply = flag.crisis ? CRISIS_MSG : EMERGENCY_MSG;
      messages.push({
        role: "assistant",
        text: reply,
        at: new Date().toISOString(),
      });
      const updated = await prisma.triageSession.update({
        where: { id: sessionId },
        data: {
          messages: messages as never,
          turns,
          status: "COMPLETED",
          redFlag: flag.key,
          urgency: "EMERGENCY",
          specialty: GENERAL,
          reasons: [flag.label] as never,
          summary: `Red-flag screening triggered: ${flag.label}. Patient reported: "${clean.slice(0, 300)}". Directed to emergency care.`,
        },
      });
      this.logger.warn(`red flag ${flag.key} → EMERGENCY (${sessionId})`);
      return this.present(updated, { crisis: !!flag.crisis });
    }

    // 2) Model turn — schema-constrained; failures fall back to the safe default.
    const specialties = await this.liveSpecialties();
    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    // 2a) Q&A mode: free-form answer under the same guardrails — no verdict.
    if (session.mode === "QA") {
      let qa: QaTurn;
      try {
        qa = await this.llm.qaTurn(
          this.qaSystemPrompt(specialties, session.language),
          history,
        );
      } catch {
        qa = {
          answer:
            "Sorry — I couldn't answer that just now. Please try again in a moment, or book a consultation if it's pressing.",
          suggestConsult: true,
          specialty: null,
        };
      }
      const answer =
        (qa.answer ?? "").trim().slice(0, 1500) ||
        "Sorry — I couldn't answer that just now. Please try again.";
      const qaSpecialty = qa.suggestConsult
        ? (specialties.find(
            (s) =>
              s.toLowerCase() === (qa.specialty ?? "").trim().toLowerCase(),
          ) ?? GENERAL)
        : null;

      messages.push({
        role: "assistant",
        text: answer,
        at: new Date().toISOString(),
      });
      const capped = turns >= QA_MAX_TURNS;
      if (capped)
        messages.push({
          role: "assistant",
          text: "We've covered a lot today! For anything more, please book a consultation with a doctor.",
          at: new Date().toISOString(),
        });
      const updated = await prisma.triageSession.update({
        where: { id: sessionId },
        data: {
          messages: messages as never,
          turns,
          model: this.llm.model,
          ...(capped ? { status: "COMPLETED" as const } : {}),
        },
      });
      return {
        ...this.present(updated, {}),
        qa: { suggestConsult: qaSpecialty != null, specialty: qaSpecialty },
      };
    }

    const forceVerdict = turns >= MAX_TURNS;

    let verdict: TriageVerdict | null = null;
    let assistantText: string;
    try {
      const turn = await this.llm.triageTurn(
        this.systemPrompt(specialties, forceVerdict, session.language),
        history,
      );
      if (turn.action === "ask" && turn.question?.trim() && !forceVerdict) {
        assistantText = turn.question.trim().slice(0, 600);
      } else if (turn.verdict) {
        verdict = turn.verdict;
        assistantText = ""; // composed below from the validated urgency
      } else {
        throw new Error("Model returned neither question nor verdict");
      }
    } catch {
      // Safe default: never strand the patient because the model hiccuped.
      verdict = {
        urgency: "CONSULT_24H",
        specialty: GENERAL,
        reasons: ["The assistant could not complete the assessment"],
        selfCare: [],
        summary: `Automated triage was interrupted. Patient's own words: "${clean.slice(0, 300)}". Defaulted to consult within 24 hours.`,
      };
      assistantText = "";
    }

    if (!verdict) {
      messages.push({
        role: "assistant",
        text: assistantText!,
        at: new Date().toISOString(),
      });
      const updated = await prisma.triageSession.update({
        where: { id: sessionId },
        data: { messages: messages as never, turns, model: this.llm.model },
      });
      return this.present(updated, {});
    }

    // 3) Validate the verdict against reality before it reaches the patient.
    const urgency: Urgency = (URGENCIES as readonly string[]).includes(
      verdict.urgency,
    )
      ? (verdict.urgency as Urgency)
      : "CONSULT_24H";
    const matched = specialties.find(
      (s) =>
        s.toLowerCase() === (verdict!.specialty ?? "").trim().toLowerCase(),
    );
    const specialty = matched ?? GENERAL;
    const reasons = (verdict.reasons ?? [])
      .filter((r) => typeof r === "string" && r.trim())
      .map((r) => r.trim().slice(0, 200))
      .slice(0, 5);
    const selfCare = (verdict.selfCare ?? [])
      .filter((r) => typeof r === "string" && r.trim())
      .map((r) => r.trim().slice(0, 200))
      .slice(0, 5);
    const summary = (verdict.summary ?? "").trim().slice(0, 1000);

    // Long-term care nudge: match the patient's own words against program
    // keywords — but never while telling someone to go to the ER.
    let programSuggestion: {
      id: string;
      name: string;
      condition: string;
      icon: string;
    } | null = null;
    if (urgency !== "EMERGENCY") {
      const haystack = [
        ...messages.filter((m) => m.role === "user").map((m) => m.text),
        summary,
        ...reasons,
        specialty,
      ].join(" ");
      programSuggestion = await this.suggestProgram(userId, haystack).catch(
        () => null,
      );
    }

    messages.push({
      role: "assistant",
      text: CLOSING[urgency],
      at: new Date().toISOString(),
    });
    const updated = await prisma.triageSession.update({
      where: { id: sessionId },
      data: {
        messages: messages as never,
        turns,
        status: "COMPLETED",
        urgency,
        specialty,
        reasons: reasons as never,
        selfCare: selfCare as never,
        summary,
        model: this.llm.model,
        suggestedProgramId: programSuggestion?.id ?? null,
      },
    });
    this.logger.log(`verdict ${urgency} → ${specialty} (${sessionId})`);
    return this.present(updated, { programSuggestion });
  }

  /** Client-facing shape (keeps raw model bookkeeping out of the app). */
  private present(
    session: {
      id: string;
      status: string;
      mode: string;
      language: string;
      messages: unknown;
      turns: number;
      redFlag: string | null;
      urgency: string | null;
      specialty: string | null;
      reasons: unknown;
      selfCare: unknown;
      summary: string;
      disposition: string | null;
    },
    extra: {
      crisis?: boolean;
      programSuggestion?: {
        id: string;
        name: string;
        condition: string;
        icon: string;
      } | null;
    },
  ) {
    return {
      id: session.id,
      status: session.status,
      mode: session.mode,
      language: session.language,
      messages: session.messages,
      turns: session.turns,
      maxTurns: session.mode === "QA" ? QA_MAX_TURNS : MAX_TURNS,
      verdict:
        session.status === "COMPLETED" && session.urgency
          ? {
              urgency: session.urgency,
              specialty: session.specialty,
              reasons: session.reasons,
              selfCare: session.selfCare,
              summary: session.summary,
              redFlag: session.redFlag,
              crisis: extra.crisis ?? false,
              programSuggestion: extra.programSuggestion ?? null,
            }
          : null,
      disposition: session.disposition,
    };
  }

  async getSession(sessionId: string, userId: string) {
    const session = await prisma.triageSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId)
      throw new ForbiddenException("Not your session");
    // Rehydrate the program suggestion so a refetched session keeps its card.
    const suggested = session.suggestedProgramId
      ? await prisma.careProgram.findUnique({
          where: { id: session.suggestedProgramId },
          select: { id: true, name: true, condition: true, icon: true },
        })
      : null;
    return this.present(session, {
      crisis: session.redFlag === "self_harm",
      programSuggestion: suggested,
    });
  }

  getMine(userId: string) {
    return prisma.triageSession.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        urgency: true,
        specialty: true,
        createdAt: true,
        disposition: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  // ─── Conversion tracking + doctor handoff ────────────────
  async setDisposition(
    sessionId: string,
    userId: string,
    action: string,
    appointmentId?: string,
  ) {
    const session = await prisma.triageSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId)
      throw new ForbiddenException("Not your session");
    if (!["INSTANT_CONSULT", "BOOKED", "DISMISSED"].includes(action))
      throw new BadRequestException("Invalid disposition");

    if (appointmentId) {
      const appt = await prisma.appointment.findFirst({
        where: { id: appointmentId, userId },
        select: { id: true },
      });
      if (!appt) throw new NotFoundException("Appointment not found");
    }
    return prisma.triageSession.update({
      where: { id: sessionId },
      data: {
        disposition: action as never,
        ...(appointmentId ? { appointmentId } : {}),
      },
    });
  }

  /**
   * Voice replies: speak one of Leenah's messages aloud (on-demand, per tap —
   * never auto-played, so TTS cost is bounded by actual listens).
   */
  async speakMessage(sessionId: string, userId: string, messageIndex: number) {
    if (!this.enabled)
      throw new BadRequestException("Voice is unavailable right now.");
    const session = await prisma.triageSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, messages: true },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId)
      throw new ForbiddenException("Not your session");

    const messages = (session.messages ?? []) as unknown as StoredMessage[];
    const msg = messages[messageIndex];
    if (!msg || msg.role !== "assistant")
      throw new BadRequestException("Nothing to read out there");
    const text = (msg.text ?? "").slice(0, 1500);
    if (!text.trim())
      throw new BadRequestException("Nothing to read out there");

    let audio: Buffer;
    try {
      audio = await this.llm.speak(text);
    } catch {
      throw new BadRequestException(
        "Couldn't generate audio right now — please read the message instead.",
      );
    }
    return {
      audio: `data:audio/mpeg;base64,${audio.toString("base64")}`,
      voice: this.llm.ttsVoice,
    };
  }

  /**
   * Care-program cross-sell: when the patient's own words mention a condition
   * a program covers (data-driven `suggestKeywords` on CareProgram), suggest
   * it with the verdict. Deterministic — no extra LLM call. Skips programs
   * the patient is already enrolled in, and never fires on EMERGENCY/crisis.
   */
  private async suggestProgram(userId: string, haystack: string) {
    const [programs, enrolled] = await Promise.all([
      prisma.careProgram.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          condition: true,
          icon: true,
          suggestKeywords: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.programEnrollment.findMany({
        where: {
          userId,
          subPatientId: null,
          status: { in: ["ACTIVE", "PAUSED"] },
        },
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
      if (hit)
        return { id: p.id, name: p.name, condition: p.condition, icon: p.icon };
    }
    return null;
  }

  /**
   * Voice input: transcribe a recorded note and hand the text back so the
   * patient can REVIEW it before sending — in a medical context the user must
   * confirm what "they said". Red-flag screening runs when the confirmed text
   * is sent as a normal message, so voice can never bypass the safety layer.
   */
  async transcribeVoice(
    sessionId: string,
    userId: string,
    audio: string,
    mimeTypeHint = "audio/m4a",
  ) {
    if (!this.enabled)
      throw new BadRequestException("Voice input is unavailable right now.");
    const session = await prisma.triageSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true, language: true },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== userId)
      throw new ForbiddenException("Not your session");
    if (session.status !== "ACTIVE")
      throw new BadRequestException("This session is already complete");

    // Accept a raw base64 string or a full data-URL.
    const base64 = audio.includes(",")
      ? audio.slice(audio.indexOf(",") + 1)
      : audio;
    const mime =
      audio.startsWith("data:") && audio.includes(";")
        ? audio.slice(5, audio.indexOf(";")) || mimeTypeHint
        : mimeTypeHint;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length < 1_000)
      throw new BadRequestException(
        "That recording was too short — try again.",
      );
    if (buffer.length > 5 * 1024 * 1024)
      throw new BadRequestException(
        "Voice note too long — keep it under about a minute.",
      );

    // Whisper language hint only where supported; Pidgin/Igbo/auto → detection.
    const hint = ["en", "ha", "yo"].includes(session.language)
      ? session.language
      : undefined;
    let transcript = "";
    try {
      transcript = await this.llm.transcribe(buffer, mime, hint);
    } catch {
      throw new BadRequestException(
        "Couldn't process that recording — please try again or type instead.",
      );
    }
    if (!transcript)
      throw new BadRequestException(
        "I couldn't hear anything in that recording — please try again.",
      );
    return { transcript: transcript.slice(0, 1000) };
  }

  /**
   * Routing-accuracy feedback from the care lead: after the consult, was
   * Leenah's specialty/urgency call right? Feeds the admin accuracy metric.
   */
  async setDoctorFeedback(
    appointmentId: string,
    doctorId: string,
    accurate: boolean,
  ) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { doctorId: true },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (appt.doctorId !== doctorId)
      throw new ForbiddenException("Not your appointment");
    const session = await prisma.triageSession.findFirst({
      where: { appointmentId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!session)
      throw new NotFoundException("No triage session for this appointment");
    return prisma.triageSession.update({
      where: { id: session.id },
      data: { doctorFeedback: accurate },
      select: { id: true, doctorFeedback: true },
    });
  }

  /** Leenah analytics: volumes, urgency mix, conversion funnel, routing accuracy. */
  async adminOverview() {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since14 = new Date(Date.now() - 14 * 86_400_000);
    const [sessions, feedback] = await Promise.all([
      prisma.triageSession.findMany({
        where: { createdAt: { gte: since30 } },
        select: {
          mode: true,
          status: true,
          urgency: true,
          language: true,
          redFlag: true,
          disposition: true,
          appointmentId: true,
          userId: true,
          suggestedProgramId: true,
          createdAt: true,
        },
      }),
      // accuracy over all time — feedback volume builds slowly
      prisma.triageSession.groupBy({
        by: ["doctorFeedback"],
        where: { doctorFeedback: { not: null } },
        _count: { id: true },
      }),
    ]);

    const count = <K extends string>(
      keys: readonly K[],
      pick: (s: (typeof sessions)[number]) => string | null,
    ): Record<K, number> => {
      const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<
        K,
        number
      >;
      for (const s of sessions) {
        const k = pick(s);
        if (k && k in out) out[k as K]++;
      }
      return out;
    };

    const completed = sessions.filter((s) => s.status === "COMPLETED");
    const verdicts = completed.filter((s) => s.urgency != null);
    // EMERGENCY ends at "call 112" — only non-emergency verdicts are bookable
    const bookable = verdicts.filter((s) => s.urgency !== "EMERGENCY");
    const linked = sessions.filter((s) => s.appointmentId != null);

    const agree =
      feedback.find((f) => f.doctorFeedback === true)?._count.id ?? 0;
    const disagree =
      feedback.find((f) => f.doctorFeedback === false)?._count.id ?? 0;

    const daily: { date: string; triage: number; qa: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const inDay = sessions.filter(
        (s) =>
          s.createdAt >= since14 &&
          s.createdAt.toISOString().slice(0, 10) === key,
      );
      daily.push({
        date: key,
        triage: inDay.filter((s) => s.mode === "TRIAGE").length,
        qa: inDay.filter((s) => s.mode === "QA").length,
      });
    }

    // Suggestion → enrollment conversion: a suggestion "converted" when that
    // user enrolled in that program AFTER the session that suggested it.
    const suggestedSessions = sessions.filter((s) => s.suggestedProgramId);
    let converted = 0;
    const byProgram = new Map<
      string,
      { suggested: number; converted: number }
    >();
    if (suggestedSessions.length) {
      const enrollments = await prisma.programEnrollment.findMany({
        where: {
          userId: { in: [...new Set(suggestedSessions.map((s) => s.userId))] },
          programId: {
            in: [
              ...new Set(
                suggestedSessions.map((s) => s.suggestedProgramId as string),
              ),
            ],
          },
        },
        select: { userId: true, programId: true, createdAt: true },
      });
      for (const s of suggestedSessions) {
        const key = s.suggestedProgramId as string;
        const agg = byProgram.get(key) ?? { suggested: 0, converted: 0 };
        agg.suggested++;
        const took = enrollments.some(
          (e) =>
            e.userId === s.userId &&
            e.programId === key &&
            e.createdAt >= s.createdAt,
        );
        if (took) {
          agg.converted++;
          converted++;
        }
        byProgram.set(key, agg);
      }
    }
    const programNames = byProgram.size
      ? await prisma.careProgram.findMany({
          where: { id: { in: [...byProgram.keys()] } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(programNames.map((p) => [p.id, p.name]));
    const programSuggestions = {
      suggested: suggestedSessions.length,
      converted,
      conversionRate: suggestedSessions.length
        ? Math.round((converted / suggestedSessions.length) * 100)
        : null,
      byProgram: [...byProgram.entries()]
        .map(([programId, v]) => ({
          programId,
          name: nameOf.get(programId) ?? "",
          ...v,
        }))
        .sort((a, b) => b.suggested - a.suggested),
    };

    return {
      assistant: ASSISTANT_NAME,
      sessions30d: sessions.length,
      byMode: count(["TRIAGE", "QA"] as const, (s) => s.mode),
      completionRate:
        sessions.length > 0
          ? Math.round((completed.length / sessions.length) * 100)
          : 0,
      redFlags30d: sessions.filter((s) => s.redFlag != null).length,
      urgency: count(URGENCIES, (s) => s.urgency),
      languages: count(Object.keys(LANGUAGES) as string[], (s) => s.language),
      funnel: {
        verdicts: verdicts.length,
        bookable: bookable.length,
        instantConsult: sessions.filter(
          (s) => s.disposition === "INSTANT_CONSULT",
        ).length,
        booked: sessions.filter((s) => s.disposition === "BOOKED").length,
        dismissed: sessions.filter((s) => s.disposition === "DISMISSED").length,
        linkedAppointments: linked.length,
        conversionRate:
          bookable.length > 0
            ? Math.round((linked.length / bookable.length) * 100)
            : 0,
      },
      accuracy: {
        agree,
        disagree,
        percent:
          agree + disagree > 0
            ? Math.round((agree / (agree + disagree)) * 100)
            : null,
      },
      programSuggestions,
      daily,
    };
  }

  /** The AI intake summary a doctor sees on a triage-linked booking. */
  async appointmentSummary(
    appointmentId: string,
    requester: { sub: string; role: string },
  ) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, userId: true, doctorId: true },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    const allowed =
      requester.role === "admin" ||
      requester.sub === appt.userId ||
      requester.sub === appt.doctorId;
    if (!allowed) throw new ForbiddenException("Not your appointment");

    const session = await prisma.triageSession.findFirst({
      where: { appointmentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        urgency: true,
        specialty: true,
        reasons: true,
        summary: true,
        redFlag: true,
        doctorFeedback: true,
        createdAt: true,
      },
    });
    if (!session)
      throw new NotFoundException("No triage session for this appointment");
    return session;
  }
}
