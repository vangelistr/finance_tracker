import { DEFAULT_WEIGHTS, type Weights } from './ranking';
import { DEFAULT_GUARDRAILS, profileFromAnswers, type Answers, type Guardrails, type RiskProfile } from './split';

/** Per-user investing settings (stored under `settings.investing`; missing keys use the defaults). */
export interface InvestingSettings {
  answers: Answers | null;
  profileOverride: RiskProfile | null;
  weights: Weights;
  guardrails: Guardrails;
}

export const DEFAULT_INVESTING_SETTINGS: InvestingSettings = {
  answers: null,
  profileOverride: null,
  weights: DEFAULT_WEIGHTS,
  guardrails: DEFAULT_GUARDRAILS,
};

export function investingSettings(stored: Partial<InvestingSettings> | undefined): InvestingSettings {
  return {
    answers: stored?.answers ?? null,
    profileOverride: stored?.profileOverride ?? null,
    weights: { ...DEFAULT_WEIGHTS, ...(stored?.weights ?? {}) },
    guardrails: { ...DEFAULT_GUARDRAILS, ...(stored?.guardrails ?? {}) },
  };
}

/** The profile in force and where it came from. Until the questionnaire is answered the cautious profile applies. */
export function effectiveProfile(s: InvestingSettings): { profile: RiskProfile; source: 'override' | 'questionnaire' | 'default' } {
  if (s.profileOverride) return { profile: s.profileOverride, source: 'override' };
  if (s.answers) return { profile: profileFromAnswers(s.answers).profile, source: 'questionnaire' };
  return { profile: 'conservative', source: 'default' };
}

/** Shown with every investing result (brief 11f); the UI uses the translated `disclaimers.investing`. */
export const INVESTING_DISCLAIMER = 'Ranked by past-performance criteria; past performance does not predict future results; educational, not financial advice.';
