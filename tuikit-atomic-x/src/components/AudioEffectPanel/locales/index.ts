import { useTranslation } from 'react-i18next';
import i18n from '../../locales';
import { en } from './en';
import { zh } from './zh-CN';

export const AUDIO_EFFECT_NAMESPACE = 'audioEffect';

i18n.addResourceBundle('zh', AUDIO_EFFECT_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', AUDIO_EFFECT_NAMESPACE, en, true, true);

export function useAudioEffectTranslation() {
  return useTranslation(AUDIO_EFFECT_NAMESPACE);
}
