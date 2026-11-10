/**
 * Login Page
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, useLoginState, useTranslation } from '@tencentcloud/react-native-tuikit-atomic-x';
import { genTestUserSig, sdkAppID } from '../../debug/UserSigGenerator';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const defaultUserName = [
  'Martijn', 'irfan', 'Rosanna', 'Franklyn', 'Maren', 'bartel', 'Marianita', 'Anneke',
  'elmira', 'ivet', 'clinton', 'virelai', '路飞', '山治', '娜美', '乌索普', '香克斯', '弗兰奇', '罗宾', '钢铁侠', '蜘蛛侠', '乔巴', '鸣人',
  '艾斯'
];

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { t } = useTranslation();
  const safeAreaInsets = useSafeAreaInsets();
  const [userID, setUserID] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginUserInfo, setSelfInfo } = useLoginState();
  const [toast, setToast] = useState<{ title: string; duration: number; seq: number } | null>(null);

  const showToast = useCallback((title: string, duration: number) => {
    setToast((prev) => ({ title, duration, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handleInput = (text: string) => {
    const value = text.replace(/[^a-zA-Z0-9_]/g, '');
    setUserID(value);
  };

  const handleLogin = async () => {
    if (!userID.trim()) {
      showToast(t('login.enterUserId'), 2000);
      return;
    }

    const trimmedUserID = userID.trim();
    setLoading(true);

    try {
      const { userSig } = genTestUserSig(trimmedUserID);

      if (!userSig) {
        showToast(t('login.userSigError'), 3000);
        setLoading(false);
        return;
      }

          await login({
        sdkAppID: sdkAppID,
        userID: trimmedUserID,
        userSig: userSig,
        onSuccess: async () => {
          setLoading(false);

          if (!loginUserInfo?.nickname || loginUserInfo.nickname === '') {
            // await setSelfInfo({
            //   userProfile: {
            //     userID: trimmedUserID,
            //     nickname: defaultUserName[Math.floor(Math.random() * defaultUserName.length)],
            //     avatarURL: 'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_03.png',
            //   },
            // });
          }

          onLoginSuccess();
        },
        onError: (error) => {
          setLoading(false);
          const errorMessage = error instanceof Error ? error.message : String(error);
          showToast(t('login.loginFailed', { error: errorMessage }), 3000);
        },
      });
    } catch (error: any) {
      setLoading(false);
      showToast(t('login.loginException', { error: error?.message || t('common.unknown') }), 3000);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeAreaInsets.top + 40,
          paddingBottom: safeAreaInsets.bottom,
          paddingLeft: safeAreaInsets.left,
          paddingRight: safeAreaInsets.right,
        },
      ]}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/rtc-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>{t('app.brandName')}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>{t('login.userId')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.userIdPlaceholder')}
            placeholderTextColor="#bcbcbc"
            value={userID}
            onChangeText={handleInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.7}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t('login.login')}</Text>
          )}
        </TouchableOpacity>
      </View>
      {toast && (
        <Toast
          key={toast.seq}
          visible
          title={toast.title}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 100,
    height: 100,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 400,
    color: 'rgba(0, 0, 0, 1)',
    textAlign: 'center',
  },
  form: {
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e6eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 20,
    paddingLeft: 16,
    paddingRight: 16,
    height: 50,
  },
  inputLabel: {
    fontSize: 17,
    color: '#222',
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#222',
    padding: 0,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#157aff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

