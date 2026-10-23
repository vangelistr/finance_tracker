import cfg2025 from '../../../config/tax/2025.json';
import cfg2026 from '../../../config/tax/2026.json';
import type { TaxConfig } from './config';

/** Reviewed per-year configs shipped with the app (docs/research/tax-efka.md section 9). Users edit their own copy. */
export const BUNDLED_TAX_CONFIGS: Readonly<Record<number, TaxConfig>> = {
  2025: cfg2025 as unknown as TaxConfig,
  2026: cfg2026 as unknown as TaxConfig,
};

export const TAX_YEARS = Object.keys(BUNDLED_TAX_CONFIGS).map(Number).sort();

/** The config year for a tax year: itself when reviewed, else the latest reviewed year (flagged by the caller). */
export function configYearFor(taxYear: number): number {
  if (BUNDLED_TAX_CONFIGS[taxYear]) return taxYear;
  const earlier = TAX_YEARS.filter((y) => y <= taxYear);
  return earlier.at(-1) ?? TAX_YEARS[0]!;
}
