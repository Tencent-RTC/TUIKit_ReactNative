import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const GIFT_NAMESPACE = 'gift';

i18n.addResourceBundle('zh', GIFT_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', GIFT_NAMESPACE, en, true, true);

export function useGiftTranslation() {
  return useTranslation(GIFT_NAMESPACE);
}
