/**
 * Deterministic red-flag screening — the safety layer that OUTRANKS the LLM.
 * Every patient message passes through these patterns BEFORE any model call;
 * a hit ends the session as EMERGENCY immediately and the model is never
 * given the chance to talk the patient down. Patterns are intentionally
 * conservative: a false escalation costs an unnecessary ER visit, a false
 * de-escalation can cost a life.
 */
export interface RedFlagRule {
  key: string;
  label: string;
  pattern: RegExp;
  /** Mental-health crisis → compassionate copy + helpline, never a booking CTA. */
  crisis?: boolean;
}

export const RED_FLAGS: RedFlagRule[] = [
  {
    key: "cardiac",
    label: "Possible heart attack symptoms",
    pattern:
      /(crushing|severe|tight\w*|heavy|squeez\w*|press\w*)[^.!?\n]{0,40}chest|chest[^.!?\n]{0,30}(pain|tight\w*|pressure|heav\w*)[^.!?\n]{0,60}(left arm|arm|jaw|breath|sweat|nausea)|heart attack/,
  },
  {
    key: "stroke",
    label: "Possible stroke symptoms",
    pattern:
      /(face|mouth)[^.!?\n]{0,30}droop|slurr\w* (speech|words)|sudden\w*[^.!?\n]{0,40}(numb|weak)\w*[^.!?\n]{0,40}(side|arm|leg|face)|can'?t (move|feel) (my )?(arm|leg|face|one side)|having a stroke/,
  },
  {
    key: "breathing",
    label: "Severe difficulty breathing",
    pattern:
      /can'?t breathe|cannot breathe|struggling to breathe|gasping for (air|breath)|(severe|extreme)\w*[^.!?\n]{0,25}(shortness of breath|difficulty breathing)|(lips|skin|fingers)[^.!?\n]{0,20}(blue|bluish)|turning blue/,
  },
  {
    key: "self_harm",
    label: "Self-harm or suicide risk",
    crisis: true,
    pattern:
      /suicid\w*|kill (myself|me|mysef)|end (my life|it all)|take my (own )?life|self.?harm|hurt(ing)? myself|don'?t want to (live|be alive|wake up)|better off dead|no reason to live|wan (die|kill mysef|kill myself|end am)|no wan live|tire of (this )?life/,
  },
  {
    key: "bleeding",
    label: "Severe or uncontrolled bleeding",
    pattern:
      /(severe|heavy|uncontroll\w*)[^.!?\n]{0,30}bleed|bleed\w*[^.!?\n]{0,30}(won'?t stop|heavily|severely|a lot)|vomit\w*[^.!?\n]{0,20}blood|cough\w*[^.!?\n]{0,15}blood|blood in (my )?(vomit|stool)[^.!?\n]{0,20}(heavy|lot)/,
  },
  {
    key: "consciousness",
    label: "Loss of consciousness or seizure",
    pattern:
      /unconscious|unresponsive|passed out and|won'?t wake|not waking up|seizure|convuls\w*|fitting right now/,
  },
  {
    key: "anaphylaxis",
    label: "Possible severe allergic reaction",
    pattern:
      /(throat|tongue|face|lips)[^.!?\n]{0,30}swell\w*|swell\w*[^.!?\n]{0,30}(throat|tongue)|anaphyla\w*|allergic[^.!?\n]{0,40}(breath|swell|throat)/,
  },
  {
    key: "pregnancy",
    label: "Pregnancy emergency",
    pattern:
      /pregnan\w*[^.!?\n]{0,60}(bleed|severe pain|no movement|baby (isn'?t|not) moving|water broke)|(heavy bleed\w*|severe pain)[^.!?\n]{0,60}pregnan/,
  },
  {
    key: "infant",
    label: "Seriously unwell infant",
    pattern:
      /(baby|infant|newborn)[^.!?\n]{0,60}(high fever|fever|not feeding|won'?t (feed|eat|wake)|limp|floppy|blue|struggl\w* to breathe)|(high fever|limp|floppy)[^.!?\n]{0,40}(baby|infant|newborn)/,
  },
  {
    key: "poisoning",
    label: "Poisoning or overdose",
    pattern:
      /overdos\w*|poison\w*|swallowed[^.!?\n]{0,40}(bleach|chemical|kerosene|battery|detergent)|took too many (pills|tablets|drugs)|drank[^.!?\n]{0,30}(bleach|chemical|kerosene)/,
  },
];

/**
 * Negation guard: "No chest pain and I can breathe fine" must NOT trigger the
 * cardiac rule. We check the clause containing the match for negation tokens.
 * Deliberately excludes "can't"/"cannot" — "can't breathe" is a danger signal,
 * not a denial. Crisis rules skip the guard entirely because negation IS the
 * signal there ("I don't want to live").
 * A negated miss degrades gracefully to the LLM (which is told to escalate);
 * a false positive destroys triage credibility — so we only suppress, never expand.
 */
const NEGATION =
  /\b(no|not|don'?t|doesn'?t|didn'?t|haven'?t|hasn'?t|isn'?t|wasn'?t|aren'?t|never|without|denies?|free of)\b/;
const CLAUSE_BREAKS = [".", ",", ";", "!", "?", "\n"];

function clauseAround(text: string, index: number): string {
  let start = 0;
  for (const c of CLAUSE_BREAKS) {
    const i = text.lastIndexOf(c, index);
    if (i + 1 > start) start = i + 1;
  }
  let end = text.length;
  for (const c of CLAUSE_BREAKS) {
    const i = text.indexOf(c, index);
    if (i >= 0 && i < end) end = i;
  }
  return text.slice(start, end);
}

export function screenRedFlags(text: string): RedFlagRule | null {
  const t = (text || "").toLowerCase();
  for (const rule of RED_FLAGS) {
    const match = rule.pattern.exec(t);
    if (!match) continue;
    if (rule.crisis) return rule;
    if (NEGATION.test(clauseAround(t, match.index))) continue;
    return rule;
  }
  return null;
}
