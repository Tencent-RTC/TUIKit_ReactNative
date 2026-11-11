import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const BARRAGE_INPUT_NAMESPACE = 'barrageInput';

i18n.addResourceBundle('zh', BARRAGE_INPUT_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', BARRAGE_INPUT_NAMESPACE, en, true, true);

export function useBarrageInputTranslation() {
  return useTranslation(BARRAGE_INPUT_NAMESPACE);
}
