import { StyleSheet } from 'react-native';

import { LIVE_STYLE_TOKENS as T } from '../../styles/tokens';
import { rpxToPx } from '../../utils';

export const styles = StyleSheet.create({
  audienceEntry: {
    position: 'absolute',
    left: rpxToPx(24),
    maxWidth: rpxToPx(560),
    height: rpxToPx(56),
    paddingLeft: rpxToPx(18),
    paddingRight: rpxToPx(18),
    borderRadius: rpxToPx(24),
    backgroundColor: T.darkBgOverlay34,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
  },
  audienceEntryPremium: {
    borderWidth: rpxToPx(2),
    borderColor: T.colorPurpleBorder,
  },
  audienceEntryElite: {
    borderWidth: rpxToPx(2),
    borderColor: T.colorWarningBorder,
  },
  entryBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: undefined,
    height: undefined,
    borderRadius: rpxToPx(22),
  },
  levelBadge: {
    position: 'relative',
    width: rpxToPx(68),
    height: rpxToPx(30),
    paddingLeft: rpxToPx(6),
    paddingRight: rpxToPx(6),
    marginRight: rpxToPx(8),
    borderRadius: rpxToPx(15),
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  levelBadgePremium: {
    borderColor: T.darkBorder42,
  },
  badgeBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: rpxToPx(68),
    height: rpxToPx(30),
  },
  badgeIcon: {
    width: rpxToPx(20),
    height: rpxToPx(20),
    marginRight: rpxToPx(2),
    flexShrink: 0,
  },
  levelNum: {
    position: 'relative',
    fontSize: rpxToPx(17),
    fontWeight: '800',
    lineHeight: rpxToPx(30),
    textAlign: 'center',
  },
  levelNumBasic: {
    color: T.colorTintPeriwinkle,
  },
  levelNumAdvanced: {
    color: T.colorTintAqua,
  },
  levelNumPremium: {
    color: T.colorTintLilac,
  },
  levelNumElite: {
    color: T.colorTintCream,
  },
  name: {
    color: T.colorTintCyan,
    fontSize: rpxToPx(26),
    fontWeight: '600',
    maxWidth: rpxToPx(240),
  },
  action: {
    color: T.darkText90,
    fontSize: rpxToPx(26),
    fontWeight: '600',
    marginLeft: rpxToPx(12),
  },
  actionPremium: {
    color: T.darkText94,
  },
  actionElite: {
    color: T.colorTintSand,
  },
});
