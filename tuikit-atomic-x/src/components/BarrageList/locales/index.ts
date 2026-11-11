import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const BARRAGE_LIST_NAMESPACE = 'barrageList';

i18n.addResourceBundle('zh', BARRAGE_LIST_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', BARRAGE_LIST_NAMESPACE, en, true, true);

export function useBarrageListTranslation() {
  return useTranslation(BARRAGE_LIST_NAMESPACE);
}
