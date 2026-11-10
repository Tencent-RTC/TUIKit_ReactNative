import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const LIVE_AUDIENCE_LIST_NAMESPACE = 'liveAudienceList';

i18n.addResourceBundle('zh', LIVE_AUDIENCE_LIST_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', LIVE_AUDIENCE_LIST_NAMESPACE, en, true, true);

export function useLiveAudienceListTranslation() {
  return useTranslation(LIVE_AUDIENCE_LIST_NAMESPACE);
}
