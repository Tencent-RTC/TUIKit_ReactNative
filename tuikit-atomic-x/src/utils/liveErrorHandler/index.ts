import i18n from '../../components/locales';
import { en } from './locales/en';
import { zh } from './locales/zh-CN';

export const LIVE_ERROR_NAMESPACE = 'liveError';

i18n.addResourceBundle('zh', LIVE_ERROR_NAMESPACE, zh, true, true);
i18n.addResourceBundle('en', LIVE_ERROR_NAMESPACE, en, true, true);

const LIVE_ERROR_MAP: Record<number, string> = {
  [-1001]: 'LiveError.Common.NotCreated',
  [-2105]: 'LiveError.Create.IllegalId',
  [-2107]: 'LiveError.Create.IllegalTitle',
  [-2108]: 'LiveError.Create.AlreadyInRoom',
  [100001]: 'LiveError.Common.Server',
  [100002]: 'LiveError.Common.InvalidParameter',
  [100003]: 'LiveError.Create.IdUsed',
  [100004]: 'LiveError.Create.RoomNotFound',
  [100011]: 'LiveError.Create.IdOccupied',
  [100012]: 'LiveError.Common.TooFrequent',
  [100026]: 'LiveError.Create.SensitiveName',
};

export function getLiveErrorMessage(code: number): string {
  const key = LIVE_ERROR_MAP[code];
  const options = { ns: LIVE_ERROR_NAMESPACE, keySeparator: false as const };
  return key
    ? i18n.t(key, options)
    : i18n.t('LiveError.Fallback', { ...options, code });
}
