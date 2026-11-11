import { useCallback } from 'react';
import { i18n, useTranslation } from '@tencentcloud/react-native-tuikit-atomic-x';

import { en } from './en';
import { zhCN } from './zh-CN';

export const LIVE_NAMESPACE = 'live';

export type LiveTranslateParams = Record<string, string | number>;
export type LiveTranslate = (key: string, params?: LiveTranslateParams) => string;

i18n.addResourceBundle('zh', LIVE_NAMESPACE, zhCN, true, true);
i18n.addResourceBundle('en', LIVE_NAMESPACE, en, true, true);

export const t: LiveTranslate = (key, params) =>
  String(i18n.t(key, { ns: LIVE_NAMESPACE, ...params }));

export function useLiveTranslation(): { t: LiveTranslate } {
  const { t: nsT, i18n: instance } = useTranslation(LIVE_NAMESPACE);
  const translate = useCallback<LiveTranslate>(
    (key, params) => String(nsT(key, params)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nsT, instance.language],
  );
  return { t: translate };
}
