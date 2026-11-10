import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const CO_HOST_PANEL_NAMESPACE = 'coHostPanel';

i18n.addResourceBundle('zh', CO_HOST_PANEL_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', CO_HOST_PANEL_NAMESPACE, en, true, true);

export function useCoHostPanelTranslation() {
  return useTranslation(CO_HOST_PANEL_NAMESPACE);
}
