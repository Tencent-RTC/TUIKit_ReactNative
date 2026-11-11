import { StyleSheet } from 'react-native';

import { rpxToPx } from '../../utils';

const DIVIDER_COLOR = '#eef0f3';

export const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  container: {
    marginBottom: rpxToPx(40),
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: rpxToPx(48),
    overflow: 'hidden',
  },
  header: {
    paddingVertical: rpxToPx(28),
    paddingHorizontal: rpxToPx(32),
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: rpxToPx(1),
    borderBottomColor: DIVIDER_COLOR,
  },
  headerText: {
    color: 'rgba(124, 133, 166, 1)',
    fontSize: rpxToPx(24),
    textAlign: 'center',
  },
  list: {
    maxHeight: rpxToPx(600),
  },
  item: {
    padding: rpxToPx(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDivider: {
    borderBottomWidth: rpxToPx(1),
    borderBottomColor: DIVIDER_COLOR,
  },
  itemText: {
    color: '#111826',
    fontSize: rpxToPx(34),
  },
  cancel: {
    marginTop: rpxToPx(16),
    backgroundColor: '#ffffff',
    borderRadius: rpxToPx(48),
    paddingVertical: rpxToPx(28),
    paddingHorizontal: rpxToPx(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#111826',
    fontSize: rpxToPx(34),
  },
});
