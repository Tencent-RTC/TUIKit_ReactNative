/**
 * Profile Page - User info display, edit nickname/avatar, logout
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    TextInput,
    Modal,
    ActivityIndicator,
    ScrollView,
    Alert,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    useLoginState,
    Toast,
    DEFAULT_AVATAR_URL,
    useTranslation,
} from '@tencentcloud/react-native-tuikit-atomic-x';

export interface ProfilePageProps {
    onBack?: () => void;
    onLogout?: () => void;
}

const AVATAR_LIST = [
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_01.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_02.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_03.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_04.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_05.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_06.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_07.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_08.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_09.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_10.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_11.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_12.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_13.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_14.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_15.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_16.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_17.png',
    'https://web.sdk.qcloud.com/component/TUIKit/assets/avatar_18.png',
];

const { width: screenWidth } = Dimensions.get('window');
const AVATAR_ITEM_SIZE = (screenWidth - 80 - 24) / 3;

export function ProfilePage({ onBack, onLogout }: ProfilePageProps) {
    const { t } = useTranslation();
    const safeAreaInsets = useSafeAreaInsets();
    const { loginUserInfo, setSelfInfo, logout } = useLoginState();

    const [isEditingNickname, setIsEditingNickname] = useState(false);
    const [isSelectingAvatar, setIsSelectingAvatar] = useState(false);
    const [selectedAvatarIndex, setSelectedAvatarIndex] = useState(0);
    const [newNickname, setNewNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ title: string; duration: number; seq: number } | null>(null);

    const showToast = useCallback((title: string, duration: number) => {
        setToast((prev) => ({ title, duration, seq: (prev?.seq ?? 0) + 1 }));
    }, []);

    const userAvatar = loginUserInfo?.avatarURL || DEFAULT_AVATAR_URL;
    const userNickname = loginUserInfo?.nickname || loginUserInfo?.userID || t('profile.notSet');
    const userID = loginUserInfo?.userID || '';

    const displayUserName = useMemo(() => {
        if (userNickname.length > 12) {
            return userNickname.substring(0, 12) + '...';
        }
        return userNickname;
    }, [userNickname]);

    const handleNicknamePress = useCallback(() => {
        if (userNickname.length > 12) {
            Alert.alert(t('profile.fullNickname'), userNickname, [{ text: t('common.confirm') }]);
        } else {
            handleEditNickname();
        }
    }, [userNickname, t]);

    const handleEditNickname = useCallback(() => {
        setNewNickname(loginUserInfo?.nickname || '');
        setIsEditingNickname(true);
    }, [loginUserInfo?.nickname]);

    const handleSaveNickname = useCallback(async () => {
        const trimmedNickname = newNickname.trim();
        if (!trimmedNickname) {
            showToast(t('profile.nicknameEmpty'), 2000);
            return;
        }

        if (trimmedNickname === loginUserInfo?.nickname) {
            setIsEditingNickname(false);
            return;
        }

        setLoading(true);
        try {
            await setSelfInfo({
                userProfile: {
                    userID: userID,
                    nickname: trimmedNickname,
                    avatarURL: loginUserInfo?.avatarURL || DEFAULT_AVATAR_URL,
                },
            });
            showToast(t('profile.nicknameSuccess'), 2000);
            setIsEditingNickname(false);
        } catch (error: any) {
            showToast(t('profile.nicknameFailed'), 2000);
        } finally {
            setLoading(false);
        }
    }, [newNickname, userID, loginUserInfo, setSelfInfo, t, showToast]);

    const showEditAvatar = useCallback(() => {
        const currentAvatarIndex = AVATAR_LIST.findIndex(
            avatar => avatar === loginUserInfo?.avatarURL
        );
        setSelectedAvatarIndex(currentAvatarIndex !== -1 ? currentAvatarIndex : 0);
        setIsSelectingAvatar(true);
    }, [loginUserInfo?.avatarURL]);

    const selectAvatar = useCallback((index: number) => {
        setSelectedAvatarIndex(index);
    }, []);

    const setCover = useCallback(async () => {
        const selectedAvatar = AVATAR_LIST[selectedAvatarIndex];

        if (selectedAvatar === loginUserInfo?.avatarURL) {
            setIsSelectingAvatar(false);
            return;
        }

        setLoading(true);
        try {
            await setSelfInfo({
                userProfile: {
                    userID: userID,
                    nickname: loginUserInfo?.nickname || userID,
                    avatarURL: selectedAvatar,
                },
            });
            showToast(t('profile.avatarSuccess'), 2000);
            setIsSelectingAvatar(false);
        } catch (error: any) {
            showToast(t('profile.avatarFailed'), 2000);
        } finally {
            setLoading(false);
        }
    }, [selectedAvatarIndex, userID, loginUserInfo, setSelfInfo, t, showToast]);

    const handleLogout = useCallback(() => {
        Alert.alert(
            t('profile.tip'),
            t('profile.logoutConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await logout();
                            onLogout?.();
                        } catch (error: any) {
                            showToast(t('profile.logoutFailed'), 2000);
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ],
        );
    }, [logout, onLogout, t, showToast]);

    const handleAvatarError = useCallback(() => {
    }, []);

    const toastNode = toast ? (
        <Toast
            key={toast.seq}
            visible
            title={toast.title}
            duration={toast.duration}
            onClose={() => setToast(null)}
        />
    ) : null;

    return (
        <View
            style={[
                styles.container,
                {
                    paddingTop: safeAreaInsets.top,
                    paddingBottom: safeAreaInsets.bottom,
                },
            ]}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={onBack}
                    activeOpacity={0.7}>
                    <Image
                        source={require('../../assets/back-black.png')}
                        style={styles.backIcon}
                        resizeMode="contain"
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('profile.title')}</Text>
                <View style={styles.headerRight} />
            </View>

            <View style={styles.userInfo}>
                <TouchableOpacity
                    style={styles.avatarWrapper}
                    onPress={showEditAvatar}
                    activeOpacity={0.8}>
                    <Image
                        source={{ uri: userAvatar }}
                        style={styles.userAvatar}
                        resizeMode="cover"
                        onError={handleAvatarError}
                    />
                </TouchableOpacity>
                <View style={styles.userDetails}>
                    <TouchableOpacity
                        style={styles.nicknameContainer}
                        onPress={handleNicknamePress}
                        activeOpacity={0.7}>
                        <Text style={styles.nicknameLabel}>{t('profile.nicknameLabel')}</Text>
                        <Text style={styles.nicknameValue} numberOfLines={1}>
                            {displayUserName}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.userIdLabel}>{t('profile.userIdLabel')}{userID}</Text>
                </View>
            </View>

            <View style={styles.menuSection}>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={handleEditNickname}
                    activeOpacity={0.7}>
                    <Text style={styles.menuButtonText}>{t('profile.editNickname')}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.menuSection}>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={handleLogout}
                    activeOpacity={0.7}>
                    <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={isEditingNickname}
                transparent
                animationType="fade"
                statusBarTranslucent={true}
                onRequestClose={() => setIsEditingNickname(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('profile.editNickname')}</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newNickname}
                            onChangeText={setNewNickname}
                            placeholder={loginUserInfo?.nickname || loginUserInfo?.userID || t('profile.nicknamePlaceholder')}
                            placeholderTextColor="#999"
                            maxLength={20}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => setIsEditingNickname(false)}
                                disabled={loading}>
                                <Text style={styles.modalButtonCancelText}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                                onPress={handleSaveNickname}
                                disabled={loading}>
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.modalButtonConfirmText}>{t('common.confirm')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                    {isEditingNickname && toastNode}
                </View>
            </Modal>

            <Modal
                visible={isSelectingAvatar}
                transparent
                animationType="slide"
                statusBarTranslucent={true}
                onRequestClose={() => setIsSelectingAvatar(false)}>
                <View style={styles.drawerContainer}>
                    <TouchableOpacity
                        style={styles.drawerOverlay}
                        activeOpacity={1}
                        onPress={() => setIsSelectingAvatar(false)}
                    />
                    <View
                        style={[
                            styles.bottomDrawer,
                            { paddingBottom: safeAreaInsets.bottom + 80 },
                        ]}>
                        <Text style={styles.drawerTitle}>{t('profile.systemGallery')}</Text>
                        <ScrollView
                            style={styles.avatarScrollView}
                            showsVerticalScrollIndicator={false}>
                            <View style={styles.avatarGrid}>
                                {AVATAR_LIST.map((url, index) => (
                                    <TouchableOpacity
                                        key={url}
                                        style={styles.avatarItem}
                                        onPress={() => selectAvatar(index)}
                                        activeOpacity={0.8}>
                                        <Image
                                            source={{ uri: url }}
                                            style={[
                                                styles.avatarItemImage,
                                                selectedAvatarIndex === index && styles.avatarItemSelected,
                                            ]}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        <View style={styles.drawerFooter}>
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={setCover}
                                disabled={loading}
                                activeOpacity={0.8}>
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>{t('profile.setAsAvatar')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                    {isSelectingAvatar && toastNode}
                </View>
            </Modal>
            {!isEditingNickname && !isSelectingAvatar && toastNode}
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
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    backIcon: {
        width: 16,
        height: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#222',
    },
    headerRight: {
        width: 40,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        marginBottom: 10,
    },
    avatarWrapper: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#e0e0e0',
        overflow: 'hidden',
        marginRight: 16,
    },
    userAvatar: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    userDetails: {
        flex: 1,
    },
    nicknameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    nicknameLabel: {
        fontSize: 18,
        color: '#000',
        fontWeight: '600',
    },
    nicknameValue: {
        fontSize: 18,
        color: '#000',
        fontWeight: '600',
        flex: 1,
    },
    userIdLabel: {
        fontSize: 14,
        color: '#999',
    },
    menuSection: {
        backgroundColor: '#fff',
        marginBottom: 10,
    },
    menuButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    menuButtonText: {
        fontSize: 16,
        color: '#007aff',
    },
    logoutButtonText: {
        fontSize: 16,
        color: '#ff4444',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#222',
        textAlign: 'center',
        marginBottom: 20,
    },
    modalInput: {
        height: 48,
        borderWidth: 1,
        borderColor: '#e5e5e5',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        color: '#222',
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 20,
    },
    modalButton: {
        flex: 1,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalButtonCancel: {
        backgroundColor: '#f5f5f5',
        marginRight: 10,
    },
    modalButtonCancelText: {
        color: '#666',
        fontSize: 16,
    },
    modalButtonConfirm: {
        backgroundColor: '#157aff',
        marginLeft: 10,
    },
    modalButtonConfirmText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    drawerContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    drawerOverlay: {
        flex: 1,
    },
    bottomDrawer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(34, 38, 46, 1)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '70%',
    },
    drawerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        paddingVertical: 20,
    },
    avatarScrollView: {
        flex: 1,
        paddingHorizontal: 20,
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    avatarItem: {
        width: AVATAR_ITEM_SIZE,
        height: AVATAR_ITEM_SIZE * 1.15,
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#23242a',
    },
    avatarItemImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        borderWidth: 3,
        borderColor: 'transparent',
    },
    avatarItemSelected: {
        borderColor: '#238CFE',
    },
    drawerFooter: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    confirmButton: {
        backgroundColor: '#0468FC',
        width: 144,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
