import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import 'intl-pluralrules'; // i18next v21+ 需要

import en from './en.json';
import zh from './zh.json';

// 定义资源
const resources = {
  en: {
    translation: en,
  },
  zh: {
    translation: zh,
  },
};

// 获取最佳匹配语言
const findBestAvailableLanguage = (): string => {
  try {
    const locales = RNLocalize.getLocales();
    console.log('[i18n] RNLocalize.getLocales():', JSON.stringify(locales));
    if (locales && locales.length > 0) {
      const languageCode = locales[0]?.languageCode;
      console.log('[i18n] Detected language code:', languageCode);
      // 支持 zh、zh-Hans、zh-Hant 等中文变体
      if (languageCode && languageCode.startsWith('zh')) {
        return 'zh';
      }
      // 如果不是中文，检查是否是英文
      if (languageCode && languageCode.startsWith('en')) {
        return 'en';
      }
    }
  } catch (error) {
    console.warn('[i18n] Failed to get locales from RNLocalize:', error);
  }
  // 默认为中文（针对中国用户）
  return 'zh';
};

const detectedLanguage = findBestAvailableLanguage();
console.log('[i18n] Initializing with language:', detectedLanguage);

// 同步初始化 i18n
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectedLanguage, // 初始化语言
    fallbackLng: 'zh', // 备用语言改为中文
    interpolation: {
      escapeValue: false, // React 已经处理了 XSS
    },
    compatibilityJSON: 'v3',
    initImmediate: false, // 同步初始化，不使用 setTimeout
    react: {
      useSuspense: false, // 禁用 Suspense，避免异步加载问题
    },
  } as any);

console.log('[i18n] Initialized, current language:', i18n.language);

export default i18n;
