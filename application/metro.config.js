const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
module.exports = withMetroConfig(
  getDefaultConfig(__dirname),
  {
    root,
    dirname: __dirname,
  },
  {
    resolver: {
      extraNodeModules: {
        '@tencentcloud/react-native-tuikit-atomic-x': path.resolve(__dirname, '../tuikit-atomic-x'),
        '@tencentcloud/react-native-tuikit-live': path.resolve(__dirname, '../live'),
      },
    },
    watchFolders: [
      path.resolve(__dirname, '../tuikit-atomic-x'),
      path.resolve(__dirname, '../live'),
    ],
  }
);
