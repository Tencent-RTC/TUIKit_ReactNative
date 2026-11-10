/**
 * TUIRoom Atomic X UI Kit
 * 
 * 统一导出入口，包含：
 * - State 管理模块 (atomic-x)
 * - UI 组件 (components)
 * - 静态资源 (static)
 */

// 导出 State 模块
export * from './atomic-x';

import './components/locales/index';
export { default as i18n } from './components/locales/index';
export { useTranslation, I18nextProvider } from 'react-i18next'; // Re-export for consumers

// 导出组件
export * from './components';

export * from './native';

export * from './utils';

export * from './constants';

// 版本信息
export const VERSION = '1.0.0';
