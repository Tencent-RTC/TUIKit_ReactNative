/**
 * Home Page - Main entry with navigation to Live and Profile
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLoginState, DEFAULT_AVATAR_URL, useTranslation } from '@tencentcloud/react-native-tuikit-atomic-x';

export interface HomePageProps {
  onNavigateToLive?: () => void;
  onNavigateToProfile?: () => void;
}

const screenWidth = Dimensions.get('window').width;
const cardWidth = screenWidth - 40;

export function HomePage({
  onNavigateToLive,
  onNavigateToProfile,
}: HomePageProps) {
  const { t } = useTranslation();
  const safeAreaInsets = useSafeAreaInsets();
  const { loginUserInfo } = useLoginState();
  const userAvatar = loginUserInfo?.avatarURL || DEFAULT_AVATAR_URL;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: safeAreaInsets.top }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/tencent-rtc-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>{t('app.brandName')}</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={onNavigateToProfile}
          activeOpacity={0.8}>
          <Image
            source={{ uri: userAvatar }}
            style={styles.avatar}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={onNavigateToLive}
          activeOpacity={0.8}>
          <View style={styles.cardHeader}>
            <Image
              source={require('../../assets/live.png')}
              style={styles.cardIcon}
              resizeMode="contain"
            />
            <Text style={styles.cardTitle}>{t('app.live')}</Text>
          </View>
          <Text style={styles.cardDesc}>
            {t('app.liveDesc')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  avatarButton: {
    padding: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
  },
  cardContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  card: {
    width: cardWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  cardDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
});
