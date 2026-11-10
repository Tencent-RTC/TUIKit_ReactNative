import { StyleSheet } from 'react-native';

import { LIVE_STYLE_TOKENS as T } from '../../styles/tokens';
import { rpxToPx } from '../../utils';

export const styles = StyleSheet.create({
  anchorInfo: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: rpxToPx(440),
    height: rpxToPx(72),
    paddingLeft: rpxToPx(4),
    paddingRight: rpxToPx(16),
    borderRadius: rpxToPx(36),
    backgroundColor: T.darkBgOverlay30,
    experimental_backgroundImage: `linear-gradient(to right, ${T.darkBgOverlay30}, ${T.colorDangerLightSoft})`,
  },
  anchorAvatar: {
    width: rpxToPx(64),
    height: rpxToPx(64),
    borderRadius: rpxToPx(32),
    borderWidth: rpxToPx(2),
    borderColor: T.darkBorderSolid,
    marginRight: rpxToPx(12),
    flexShrink: 0,
  },
  anchorCopy: {
    flexDirection: 'column',
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  anchorName: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(28),
    fontWeight: '500',
    marginBottom: rpxToPx(4),
    maxWidth: rpxToPx(180),
    height: rpxToPx(38),
  },
  anchorMeta: {
    color: T.darkText68,
    fontSize: rpxToPx(16),
    fontWeight: '400',
    maxWidth: rpxToPx(180),
    height: rpxToPx(20),
  },
  fanClubButton: {
    width: rpxToPx(84),
    height: rpxToPx(56),
    marginLeft: rpxToPx(12),
    flexShrink: 0,
  },
  fanClubIcon: {
    width: rpxToPx(84),
    height: rpxToPx(56),
  },

  streamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: rpxToPx(440),
    backgroundColor: T.maskLight,
    padding: rpxToPx(4),
    borderRadius: rpxToPx(40),
  },
  streamAvatar: {
    width: rpxToPx(64),
    height: rpxToPx(64),
    borderRadius: rpxToPx(32),
    borderWidth: rpxToPx(2),
    borderColor: T.darkBorderSolid,
    marginRight: rpxToPx(12),
    flexShrink: 0,
  },
  streamDetails: {
    flexDirection: 'column',
    flexShrink: 1,
    minWidth: 0,
  },
  streamTitle: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(28),
    fontWeight: '500',
    marginBottom: rpxToPx(4),
    maxWidth: rpxToPx(180),
    height: rpxToPx(38),
  },
  streamMeta: {
    color: T.darkText60,
    fontSize: rpxToPx(16),
    maxWidth: rpxToPx(180),
  },
  followButton: {
    height: rpxToPx(64),
    width: rpxToPx(124),
    borderRadius: rpxToPx(32),
    backgroundColor: T.colorLive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: rpxToPx(16),
    flexShrink: 0,
  },
  followButtonFollowing: {
    backgroundColor: T.colorLiveSoft,
  },
  followText: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(26),
    fontWeight: '600',
  },
  followTextFollowing: {
    color: T.darkText82,
  },
});
