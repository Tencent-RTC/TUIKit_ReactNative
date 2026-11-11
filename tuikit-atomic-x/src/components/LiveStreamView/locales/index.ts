import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const LIVE_STREAM_VIEW_NAMESPACE = 'liveStreamView';

i18n.addResourceBundle('zh', LIVE_STREAM_VIEW_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', LIVE_STREAM_VIEW_NAMESPACE, en, true, true);

export function useLiveStreamViewTranslation() {
  return useTranslation(LIVE_STREAM_VIEW_NAMESPACE);
}
