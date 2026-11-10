import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const LIVE_LIST_NAMESPACE = 'liveList';

i18n.addResourceBundle('zh', LIVE_LIST_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', LIVE_LIST_NAMESPACE, en, true, true);

export function useLiveListTranslation() {
  return useTranslation(LIVE_LIST_NAMESPACE);
}
