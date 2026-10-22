import { z } from 'zod';
import { currencySchema, localeSchema, nameSchema, timeSchema, timezoneSchema } from './common';

const toggle = z.boolean();

export const settingsPatchSchema = z.strictObject({
  name: nameSchema.optional(),
  locale: localeSchema.optional(),
  currency: currencySchema.optional(),
  timezone: timezoneSchema.optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  investingEnabled: z.boolean().optional(),
  notifications: z
    .strictObject({
      daily: z.strictObject({ enabled: toggle.optional(), time: timeSchema.optional() }).optional(),
      monthly: z.strictObject({ enabled: toggle.optional(), time: timeSchema.optional() }).optional(),
      renewals: z
        .strictObject({ enabled: toggle.optional(), defaultDaysBefore: z.number().int().min(0).max(60).optional() })
        .optional(),
      overspend: z
        .strictObject({
          enabled: toggle.optional(),
          thresholds: z.array(z.number().int().min(1).max(500)).min(1).max(4).optional(),
        })
        .optional(),
      marketDigest: z.strictObject({ enabled: toggle.optional() }).optional(),
      backup: z.strictObject({ enabled: toggle.optional() }).optional(),
    })
    .optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** Flattens a nested patch into Mongo `$set` paths under the given prefixes. */
export function settingsPatchToSet(patch: SettingsPatch): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const key of ['name', 'locale', 'currency', 'timezone'] as const) {
    if (patch[key] !== undefined) set[key] = patch[key];
  }
  if (patch.theme !== undefined) set['settings.theme'] = patch.theme;
  if (patch.investingEnabled !== undefined) set['settings.investingEnabled'] = patch.investingEnabled;
  for (const [group, values] of Object.entries(patch.notifications ?? {})) {
    for (const [field, value] of Object.entries(values ?? {})) {
      if (value === undefined) continue;
      set[`settings.notifications.${group}.${field}`] =
        field === 'thresholds' ? [...new Set(value as number[])].sort((a, b) => a - b) : value;
    }
  }
  return set;
}
