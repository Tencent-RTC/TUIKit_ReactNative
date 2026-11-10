import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const CO_GUEST_PANEL_NAMESPACE = 'coGuestPanel';

i18n.addResourceBundle('zh', CO_GUEST_PANEL_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', CO_GUEST_PANEL_NAMESPACE, en, true, true);

export function useCoGuestPanelTranslation() {
  return useTranslation(CO_GUEST_PANEL_NAMESPACE);
}
