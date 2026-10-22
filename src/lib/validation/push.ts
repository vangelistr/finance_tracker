import { z } from 'zod';

export const pushSubscriptionSchema = z.strictObject({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.strictObject({
    p256dh: z.string().min(16).max(200),
    auth: z.string().min(8).max(100),
  }),
});

export const pushUnsubscribeSchema = z.strictObject({ endpoint: z.url({ protocol: /^https$/ }).max(1000) });
