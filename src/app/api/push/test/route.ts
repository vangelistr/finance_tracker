import { createTranslator } from 'use-intl/core';
import { loadMessages } from '@/i18n/messages';
import { api } from '@/server/http/api';
import { webPushSender } from '@/server/push/send';

export const POST = api('user', async ({ auth }) => {
  const { user } = auth!;
  const t = createTranslator({ locale: user.locale, messages: await loadMessages(user.locale), namespace: 'push' });
  const result = await webPushSender.sendToUser(user._id, { title: t('testTitle'), body: t('testBody'), url: '/settings', tag: 'test' });
  return result;
});
