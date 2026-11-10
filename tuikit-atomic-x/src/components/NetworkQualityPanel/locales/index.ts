import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const NETWORK_QUALITY_PANEL_NAMESPACE = 'networkQualityPanel';

i18n.addResourceBundle('zh', NETWORK_QUALITY_PANEL_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', NETWORK_QUALITY_PANEL_NAMESPACE, en, true, true);

export function useNetworkQualityPanelTranslation() {
  return useTranslation(NETWORK_QUALITY_PANEL_NAMESPACE);
}
