import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const BEAUTY_NAMESPACE = 'beauty';

i18n.addResourceBundle('zh', BEAUTY_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', BEAUTY_NAMESPACE, en, true, true);

export function useBeautyTranslation() {
  return useTranslation(BEAUTY_NAMESPACE);
}
