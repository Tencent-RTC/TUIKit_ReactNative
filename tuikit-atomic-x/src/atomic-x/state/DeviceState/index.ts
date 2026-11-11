/**
 * @module DeviceState
 * @module_description
 * Device State Management Module
 * Core Features: Manages audio/video devices like cameras and microphones, providing device status monitoring, permission checking, and basic device services.
 * Technical Features: Supports multi-device management, real-time device status monitoring, dynamic permission checking, and automatic device failure recovery.
 * Business Value: Provides a stable device foundation for live streaming systems, ensuring reliability of audio/video capture and user experience.
 * Use Cases: Device management, permission control, audio/video capture, device failure handling, and other fundamental technical scenarios.
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { callNativeAPI, createStateError } from '../../utils';
import { addListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import {
    DeviceStatus,
    DeviceStatusCode,
    DeviceErrorEnum,
    DeviceErrorCode,
    AudioOutput,
    MirrorType,
} from './types';
import type {
    DeviceStatusType,
    DeviceStatusCodeType,
    DeviceErrorType,
    DeviceErrorCodeType,
    AudioOutputType,
    OpenLocalMicrophoneOptions,
    SetAudioRouteOptions,
    OpenLocalCameraOptions,
    SwitchCameraOptions,
    StartCameraTestOptions,
    UpdateVideoQualityOptions,
    SwitchMirrorOptions,
    VolumeOptions,
    NetworkInfo,
    LocalVideoQuality,
} from './types';
import { deviceStore } from './store';
import { shallowEqual } from '../internal/equality';

/**
 * Device status event name constants
 */
const DEVICE_EVENTS = [
    'microphoneStatus',
    'microphoneLastError',
    'captureVolume',
    'currentMicVolume',
    'outputVolume',
    'cameraStatus',
    'cameraLastError',
    'isFrontCamera',
    'localMirrorType',
    'localVideoQuality',
    'currentAudioRoute',
    'screenStatus',
    'networkInfo',
];

/**
 * Device status code to device status mapping
 */
const DEVICE_STATUS_MAP: Record<DeviceStatusCodeType, DeviceStatusType> = {
    [DeviceStatusCode.OFF]: DeviceStatus.OFF,
    [DeviceStatusCode.ON]: DeviceStatus.ON,
} as const;

/**
 * Device error code to device error mapping
 */
const DEVICE_ERROR_MAP: Record<DeviceErrorCodeType, DeviceErrorType> = {
    [DeviceErrorCode.NO_ERROR]: DeviceErrorEnum.NO_ERROR,
    [DeviceErrorCode.NO_DEVICE_DETECTED]: DeviceErrorEnum.NO_DEVICE_DETECTED,
    [DeviceErrorCode.NO_SYSTEM_PERMISSION]: DeviceErrorEnum.NO_SYSTEM_PERMISSION,
    [DeviceErrorCode.NOT_SUPPORT_CAPTURE]: DeviceErrorEnum.NOT_SUPPORT_CAPTURE,
    [DeviceErrorCode.OCCUPIED_ERROR]: DeviceErrorEnum.OCCUPIED_ERROR,
    [DeviceErrorCode.UNKNOWN_ERROR]: DeviceErrorEnum.UNKNOWN_ERROR,
} as const;

/**
 * Safely parse JSON
 */
function safeJsonParse<T>(json: string, defaultValue: T): T {
    try {
        if (!json || typeof json !== 'string') {
            return defaultValue;
        }
        return JSON.parse(json) as T;
    } catch (error) {
        console.error('safeJsonParse error:', error);
        return defaultValue;
    }
}

const AUDIO_ROUTE_STRING_MAP: Record<string, number> = {
    'SPEAKERPHONE': 0,
    'EARPIECE': 1,
};

const VIDEO_QUALITY_STRING_MAP: Record<string, number> = {
    'VIDEOQUALITY_360P': 1,
    'VIDEOQUALITY_540P': 2,
    'VIDEOQUALITY_720P': 3,
    'VIDEOQUALITY_1080P': 4,
};

/**
 * Map status code to device status
 */
function mapStatusCodeToDeviceStatus(
    statusCode: number
): DeviceStatusType | null {
    const mappedStatus = DEVICE_STATUS_MAP[statusCode as DeviceStatusCodeType];
    if (!mappedStatus) {
        console.warn(`Unknown device status code: ${statusCode}`);
        return null;
    }
    return mappedStatus;
}

/**
 * Map error code to device error
 */
function mapErrorCodeToDeviceError(errorCode: number): DeviceErrorType | null {
    const mappedError = DEVICE_ERROR_MAP[errorCode as DeviceErrorCodeType];
    if (!mappedError) {
        console.warn(`Unknown device error code: ${errorCode}`);
        return null;
    }
    return mappedError;
}
/**
 * Handle device status change events (module-level, shared by all hook instances)
 */
function handleNativeEvent(eventName: string) {
    return (event: Record<string, unknown>) => {
        try {
            const data = event && typeof event === 'object' && !Array.isArray(event)
                ? event
                : typeof event === 'string'
                    ? JSON.parse(event)
                    : event;

            if (data && typeof data === 'object' && !Array.isArray(data)) {
                const updates: Record<string, unknown> = {};

                Object.keys(data).forEach((key) => {
                    if (DEVICE_EVENTS.includes(key)) {
                        const value = data[key];

                        if (key === 'microphoneStatus') {
                            const statusCode = typeof value === 'number' ? value : (Number(value) || -1);
                            const status = mapStatusCodeToDeviceStatus(statusCode);
                            if (status) {
                                updates.microphoneStatus = status;
                            }
                        } else if (key === 'microphoneLastError') {
                            const errorCode = typeof value === 'number' ? value : (Number(value) || -1);
                            const error = mapErrorCodeToDeviceError(errorCode);
                            if (error) {
                                updates.microphoneLastError = error;
                            }
                        } else if (key === 'captureVolume') {
                            updates.captureVolume = typeof value === 'number' ? value : (Number(value) || 0);
                        } else if (key === 'currentMicVolume') {
                            updates.currentMicVolume = typeof value === 'number' ? value : (Number(value) || 0);
                        } else if (key === 'outputVolume') {
                            updates.outputVolume = typeof value === 'number' ? value : (Number(value) || 0);
                        } else if (key === 'cameraStatus') {
                            const statusCode = typeof value === 'number' ? value : (Number(value) || -1);
                            const status = mapStatusCodeToDeviceStatus(statusCode);
                            if (status) {
                                updates.cameraStatus = status;
                            }
                        } else if (key === 'cameraLastError') {
                            const errorCode = typeof value === 'number' ? value : (Number(value) || -1);
                            const error = mapErrorCodeToDeviceError(errorCode);
                            if (error) {
                                updates.cameraLastError = error;
                            }
                        } else if (key === 'isFrontCamera') {
                            updates.isFrontCamera = typeof value === 'boolean' ? value : Boolean(value);
                        } else if (key === 'localMirrorType') {
                            updates.localMirrorType = typeof value === 'number' ? value as MirrorType : (Number(value) as MirrorType);
                        } else if (key === 'localVideoQuality') {
                            const payloadStr = typeof value === 'string' ? value : JSON.stringify(value);
                            const localVideoQuality = safeJsonParse<LocalVideoQuality>(payloadStr, {} as LocalVideoQuality);
                            if (!shallowEqual(localVideoQuality, deviceStore.getState().localVideoQuality)) {
                                updates.localVideoQuality = localVideoQuality;
                            }
                        } else if (key === 'currentAudioRoute') {
                            const payloadStr = typeof value === 'string' ? value : JSON.stringify(value);
                            const currentAudioRoute = safeJsonParse<AudioOutputType>(payloadStr, AudioOutput.SPEAKERPHONE);
                            if (!shallowEqual(currentAudioRoute, deviceStore.getState().currentAudioRoute)) {
                                updates.currentAudioRoute = currentAudioRoute;
                            }
                        } else if (key === 'screenStatus') {
                            const statusCode = typeof value === 'number' ? value : (Number(value) || -1);
                            const status = mapStatusCodeToDeviceStatus(statusCode);
                            if (status) {
                                updates.screenStatus = status;
                            }
                        } else if (key === 'networkInfo') {
                            const networkInfo = typeof value === 'string'
                                ? safeJsonParse<NetworkInfo>(value, {} as NetworkInfo)
                                : ((value ?? {}) as NetworkInfo);
                            if (!shallowEqual(networkInfo, deviceStore.getState().networkInfo)) {
                                updates.networkInfo = networkInfo;
                            }
                        }
                    }
                });

                if (Object.keys(updates).length > 0) {
                    deviceStore.setState(updates);
                }
            }
        } catch (error) {
            console.error(`[DeviceState] ${eventName} event parse error:`, error);
        }
    };
}

/**
 * Register Native event listeners at module load time (once, never removed)
 */
DEVICE_EVENTS.forEach((eventName) => {
    const keyObject: HybridListenerKey = {
        type: 'state',
        store: 'DeviceStore',
        name: eventName,
        roomID: null,
        listenerID: null,
    };
    const key = JSON.stringify(keyObject);
    addListener(key, handleNativeEvent(eventName));
});

export function clearDeviceState(): void {
    deviceStore.clearState();
}

/**
 * DeviceState Hook
 * 
 * @example
 * ```tsx
 * import { useDeviceState } from '@/src/atomic-x/state/DeviceState';
 * 
 * function DeviceComponent() {
 *   const { 
 *     microphoneStatus, 
 *     cameraStatus, 
 *     openLocalMicrophone, 
 *     openLocalCamera 
 *   } = useDeviceState();
 * 
 *   const handleOpenMic = async () => {
 *     await openLocalMicrophone({
 *       onSuccess: () => console.log('Microphone opened'),
 *       onError: (error) => console.error('Open microphone failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       <Text>Microphone status: {microphoneStatus}</Text>
 *       <Button onPress={handleOpenMic} title="Open Microphone" />
 *     </View>
 *   );
 * }
 * ```
 */
function useDevice(listen: boolean) {
    // Get initial state from global store
    const initialState = deviceStore.getState();

    /**
     * @memberof module:DeviceState
     * @type {DeviceStatusType | undefined}
     * @example
     * ```tsx
     * const { microphoneStatus } = useDeviceState();
     * 
     * console.log('Microphone status:', microphoneStatus);
     * if (microphoneStatus === DeviceStatus.ON) {
     *   console.log('Microphone is on');
     * }
     * ```
     */
    const [microphoneStatus, setMicrophoneStatus] = useState<DeviceStatusType | undefined>(initialState.microphoneStatus);

    /**
     * @memberof module:DeviceState
     * @type {DeviceErrorType | undefined}
     * @example
     * ```tsx
     * const { microphoneLastError } = useDeviceState();
     * 
     * if (microphoneLastError === DeviceErrorEnum.NO_SYSTEM_PERMISSION) {
     *   console.log('Microphone permission not granted');
     * }
     * ```
     */
    const [microphoneLastError, setMicrophoneLastError] = useState<DeviceErrorType | undefined>(initialState.microphoneLastError);

    /**
     * @memberof module:DeviceState
     * @type {boolean}
     * @example
     * ```tsx
     * const { hasPublishAudioPermission } = useDeviceState();
     * 
     * console.log('Audio publish permission:', hasPublishAudioPermission);
     * ```
     */
    const [hasPublishAudioPermission, setHasPublishAudioPermission] = useState<boolean>(initialState.hasPublishAudioPermission);

    /**
     * @memberof module:DeviceState
     * @type {number}
     * @example
     * ```tsx
     * const { captureVolume } = useDeviceState();
     * 
     * console.log('Capture volume:', captureVolume);
     * ```
     */
    const [captureVolume, setStateCaptureVolume] = useState<number>(initialState.captureVolume);

    /**
     * @memberof module:DeviceState
     * @type {number}
     * @example
     * ```tsx
     * const { currentMicVolume } = useDeviceState();
     * 
     * console.log('Current microphone volume:', currentMicVolume);
     * ```
     */
    const [currentMicVolume, setCurrentMicVolume] = useState<number>(initialState.currentMicVolume);

    /**
     * @memberof module:DeviceState
     * @type {DeviceStatusType | undefined}
     * @example
     * ```tsx
     * const { cameraStatus } = useDeviceState();
     * 
     * console.log('Camera status:', cameraStatus);
     * if (cameraStatus === DeviceStatus.ON) {
     *   console.log('Camera is on');
     * }
     * ```
     */
    const [cameraStatus, setCameraStatus] = useState<DeviceStatusType | undefined>(initialState.cameraStatus);

    /**
     * @memberof module:DeviceState
     * @type {DeviceErrorType | undefined}
     * @example
     * ```tsx
     * const { cameraLastError } = useDeviceState();
     * 
     * if (cameraLastError === DeviceErrorEnum.NO_DEVICE_DETECTED) {
     *   console.log('No camera detected');
     * }
     * ```
     */
    const [cameraLastError, setCameraLastError] = useState<DeviceErrorType | undefined>(initialState.cameraLastError);

    /**
     * @memberof module:DeviceState
     * @type {boolean | undefined}
     * @example
     * ```tsx
     * const { isFrontCamera } = useDeviceState();
     * 
     * console.log('Is front camera:', isFrontCamera);
     * ```
     */
    const [isFrontCamera, setIsFrontCamera] = useState<boolean | undefined>(initialState.isFrontCamera);

    /**
     * @memberof module:DeviceState
     * @type {MirrorType}
     * @example
     * ```tsx
     * const { localMirrorType } = useDeviceState();
     * 
     * console.log('Local mirror type:', localMirrorType);
     * ```
     */
    const [localMirrorType, setLocalMirrorType] = useState<MirrorType>(initialState.localMirrorType);

    /**
     * @memberof module:DeviceState
     * @type {LocalVideoQuality | undefined}
     * @example
     * ```tsx
     * const { localVideoQuality } = useDeviceState();
     * 
     * if (localVideoQuality) {
     *   console.log('Video quality:', localVideoQuality);
     * }
     * ```
     */
    const [localVideoQuality, setLocalVideoQuality] = useState<LocalVideoQuality | undefined>(initialState.localVideoQuality);

    /**
     * @memberof module:DeviceState
     * @type {number}
     * @example
     * ```tsx
     * const { outputVolume } = useDeviceState();
     * 
     * console.log('Output volume:', outputVolume);
     * ```
     */
    const [outputVolume, setStateOutputVolume] = useState<number>(initialState.outputVolume);

    /**
     * @memberof module:DeviceState
     * @type {AudioOutputType | undefined}
     * @example
     * ```tsx
     * const { currentAudioRoute } = useDeviceState();
     * 
     * console.log('Current audio route:', currentAudioRoute);
     * ```
     */
    const [currentAudioRoute, setCurrentAudioRoute] = useState<AudioOutputType | undefined>(initialState.currentAudioRoute);

    /**
     * @memberof module:DeviceState
     * @type {DeviceStatusType | undefined}
     * @example
     * ```tsx
     * const { screenStatus } = useDeviceState();
     * 
     * console.log('Screen share status:', screenStatus);
     * ```
     */
    const [screenStatus, setScreenStatus] = useState<DeviceStatusType | undefined>(initialState.screenStatus);

    /**
     * @memberof module:DeviceState
     * @type {NetworkInfo | undefined}
     * @example
     * ```tsx
     * const { networkInfo } = useDeviceState();
     * 
     * if (networkInfo) {
     *   console.log('Network info:', networkInfo);
     * }
     * ```
     */
    const [networkInfo, setNetworkInfo] = useState<NetworkInfo | undefined>(initialState.networkInfo);

    // Subscribe to global store state changes
    useEffect(() => {
        if (!listen) return undefined;
        // Subscribe to state changes
        const unsubscribe = deviceStore.subscribe((state) => {
            setMicrophoneStatus(state.microphoneStatus);
            setMicrophoneLastError(state.microphoneLastError);
            setHasPublishAudioPermission(state.hasPublishAudioPermission);
            setStateCaptureVolume(state.captureVolume);
            setCurrentMicVolume(state.currentMicVolume);
            setCameraStatus(state.cameraStatus);
            setCameraLastError(state.cameraLastError);
            setIsFrontCamera(state.isFrontCamera);
            setLocalMirrorType(state.localMirrorType);
            setLocalVideoQuality(state.localVideoQuality);
            setStateOutputVolume(state.outputVolume);
            setCurrentAudioRoute(state.currentAudioRoute);
            setScreenStatus(state.screenStatus);
            setNetworkInfo(state.networkInfo);
        });

        // Clean up subscription
        return unsubscribe;
    }, [listen]);

    /**
     * Request Android permissions
     * 
     * @param permission - Permission string or array of permission strings
     * @example
     * ```tsx
     * // Request single permission
     * await requestAndroidPermission('android.permission.RECORD_AUDIO');
     * 
     * // Request multiple permissions
     * await requestAndroidPermission([
     *   'android.permission.RECORD_AUDIO',
     *   'android.permission.CAMERA'
     * ]);
     * ```
     */
    const requestAndroidPermission = useCallback(async (
        permission: string | string[]
    ): Promise<boolean> => {
        if (Platform.OS !== 'android') {
            return true;
        }

        // Permission string to PermissionsAndroid.PERMISSIONS mapping
        const permissionMap: Record<string, string> = {
            'android.permission.RECORD_AUDIO': PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            'android.permission.CAMERA': PermissionsAndroid.PERMISSIONS.CAMERA,
        };

        // Convert to array for unified processing
        const permissionArray = Array.isArray(permission) ? permission : [permission];

        // Map permission strings to PermissionsAndroid.PERMISSIONS values
        const androidPermissions = permissionArray
            .map((perm) => permissionMap[perm])
            .filter((perm): perm is string => perm !== undefined);

        if (androidPermissions.length === 0) {
            console.warn('No valid Android permissions found');
            return false;
        }

        try {
            // Use request for single permission, requestMultiple for multiple permissions
            if (androidPermissions.length === 1) {
                const result = await PermissionsAndroid.request(androidPermissions[0] as any);
                return result === PermissionsAndroid.RESULTS.GRANTED;
            }
            const results = await PermissionsAndroid.requestMultiple(androidPermissions as any);
            return Object.values(results).every((result) => result === PermissionsAndroid.RESULTS.GRANTED);
        } catch (error) {
            console.error('Failed to request Android permissions:', error);
            return false;
        }
    }, []);

    /**
     * Open local microphone
     * 
     * @param params - Microphone parameters (optional)
     * @example
     * ```tsx
     * await openLocalMicrophone({
     *   onSuccess: () => console.log('Microphone opened'),
     *   onError: (error) => console.error('Open microphone failed:', error)
     * });
     * ```
     */
    const openLocalMicrophone = useCallback(async (params?: OpenLocalMicrophoneOptions): Promise<void> => {
        const { onSuccess, onError, ...microphoneParams } = params || {};

        // Request recording permission on Android platform
        if (Platform.OS === 'android' && !(await requestAndroidPermission('android.permission.RECORD_AUDIO'))) {
            onError?.(new Error('Android permission denied: android.permission.RECORD_AUDIO'));
            return;
        }

        try {
            const result = await callNativeAPI<void>('openLocalMicrophone', microphoneParams);

            if (result.success) {
                // Only trigger callback on success, state update is handled by event listener
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Open local microphone failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, [requestAndroidPermission]);

    /**
     * Close local microphone
     * 
     * @example
     * ```tsx
     * closeLocalMicrophone();
     * ```
     */
    const closeLocalMicrophone = useCallback(async (): Promise<void> => {
        try {
            await callNativeAPI<void>('closeLocalMicrophone');
        } catch (error) {
            console.error('closeLocalMicrophone error:', error);
        }
    }, []);

    /**
     * Set capture volume
     * 
     * @param params - Volume parameters
     * @example
     * ```tsx
     * setCaptureVolume({
     *   volume: 80,
     *   onSuccess: () => console.log('Volume set successfully'),
     *   onError: (error) => console.error('Set volume failed:', error)
     * });
     * ```
     */
    const setCaptureVolume = useCallback(async (params: VolumeOptions): Promise<void> => {
        const { onSuccess, onError, ...volumeParams } = params;

        try {
            const result = await callNativeAPI<void>('setCaptureVolume', volumeParams);

            if (result.success) {
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Set capture volume failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Set output volume
     * 
     * @param params - Volume parameters
     * @example
     * ```tsx
     * setOutputVolume({
     *   volume: 90,
     *   onSuccess: () => console.log('Output volume set successfully'),
     *   onError: (error) => console.error('Set output volume failed:', error)
     * });
     * ```
     */
    const setOutputVolume = useCallback(async (params: VolumeOptions): Promise<void> => {
        const { onSuccess, onError, ...volumeParams } = params;

        try {
            const result = await callNativeAPI<void>('setOutputVolume', volumeParams);

            if (result.success) {
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Set output volume failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Set audio route
     * 
     * @param params - Audio route parameters
     * @example
     * ```tsx
     * setAudioRoute({
     *   audioRoute: 'SPEAKERPHONE',
     *   onSuccess: () => console.log('Audio route set successfully'),
     *   onError: (error) => console.error('Set audio route failed:', error)
     * });
     * ```
     */
    const setAudioRoute = useCallback(async (params: SetAudioRouteOptions): Promise<void> => {
        const routeValue = AUDIO_ROUTE_STRING_MAP[params.audioRoute] ?? 0;
        
        const { onSuccess, onError, audioRoute, ...otherParams } = params;
        const routeParams = {
            ...otherParams,
            audioRoute: routeValue,
        };

        try {
            const result = await callNativeAPI<void>('setAudioRoute', routeParams);

            if (result.success) {
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Set audio route failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Open local camera
     * 
     * @param params - Camera parameters (optional)
     * @example
     * ```tsx
     * await openLocalCamera({
     *   isFront: true,
     *   onSuccess: () => console.log('Camera opened'),
     *   onError: (error) => console.error('Open camera failed:', error)
     * });
     * ```
     */
    const openLocalCamera = useCallback(async (params?: OpenLocalCameraOptions): Promise<void> => {
        const { onSuccess, onError, ...cameraParams } = params || {};

        // Request camera permission on Android platform
        if (Platform.OS === 'android' && !(await requestAndroidPermission('android.permission.CAMERA'))) {
            onError?.(new Error('Android permission denied: android.permission.CAMERA'));
            return;
        }

        try {
            const result = await callNativeAPI<void>('openLocalCamera', cameraParams);

            if (result.success) {
                // Only trigger callback on success, state update is handled by event listener
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Open local camera failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, [requestAndroidPermission]);

    /**
     * Close local camera
     * 
     * @example
     * ```tsx
     * closeLocalCamera();
     * ```
     */
    const closeLocalCamera = useCallback(async (): Promise<void> => {
        try {
            await callNativeAPI<void>('closeLocalCamera');
        } catch (error) {
            console.error('closeLocalCamera error:', error);
        }
    }, []);

    /**
     * Switch camera front/back
     * 
     * @param params - Switch parameters
     * @example
     * ```tsx
     * switchCamera({
     *   isFront: true,
     *   onSuccess: () => console.log('Camera switched successfully'),
     *   onError: (error) => console.error('Switch camera failed:', error)
     * });
     * ```
     */
    const switchCamera = useCallback(async (params: SwitchCameraOptions): Promise<void> => {
        const { onSuccess, onError, ...switchParams } = params;

        try {
            const result = await callNativeAPI<void>('switchCamera', switchParams);

            if (result.success) {
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Switch camera failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    const startCameraTest = useCallback(async (params: StartCameraTestOptions): Promise<void> => {
        const { onSuccess, onError, ...testParams } = params;

        if (Platform.OS === 'android' && !(await requestAndroidPermission('android.permission.CAMERA'))) {
            onError?.(new Error('Android permission denied: android.permission.CAMERA'));
            return;
        }

        try {
            const result = await callNativeAPI<void>('startCameraTest', testParams);

            if (result.success) {
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Start camera test failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, [requestAndroidPermission]);

    const stopCameraTest = useCallback((): void => {
        callNativeAPI<void>('stopCameraTest').catch((error) => {
            console.error('stopCameraTest error:', error);
        });
    }, []);

    /**
     * Switch mirror
     * 
     * @param params - Mirror parameters
     * @example
     * ```tsx
     * switchMirror({
     *   mirrorType: MirrorType.AUTO,
     *   onSuccess: () => console.log('Mirror switched successfully'),
     *   onError: (error) => console.error('Switch mirror failed:', error)
     * });
     * ```
     */
    const switchMirror = useCallback(async (params: SwitchMirrorOptions): Promise<void> => {
        const { onSuccess, onError, mirrorType, ...otherParams } = params;
        const mirrorParams = {
            ...otherParams,
            mirrorType: mirrorType, // Directly use enum value (number)
        };

        try {
            const result = await callNativeAPI<void>('switchMirror', mirrorParams);

            if (result.success) {
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Switch mirror failed');
                onError?.(error);
            }
        } catch (error: any) {
            console.error('[DeviceState] switchMirror error:', error);
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, [localMirrorType]);

    /**
     * Update video quality
     
     * 
     * @param params - Video quality parameters
     * @example
     * ```tsx
     * updateVideoQuality({
     *   quality: 'VIDEOQUALITY_1080P',
     *   onSuccess: () => console.log('Video quality updated successfully'),
     *   onError: (error) => console.error('Update video quality failed:', error)
     * });
     * ```
     */
    const updateVideoQuality = useCallback(async (params: UpdateVideoQualityOptions): Promise<void> => {
        const qualityValue = VIDEO_QUALITY_STRING_MAP[params.quality] ?? 1;
        
        const { onSuccess, onError, quality, ...otherParams } = params;
        const qualityParams = {
            ...otherParams,
            quality: qualityValue,
        };

        try {
            const result = await callNativeAPI<void>('updateVideoQuality', qualityParams);

            if (result.success) {
                onSuccess?.();
            } else {
                const error = createStateError(result, 'Update video quality failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Start screen share
     * 
     * @example
     * ```tsx
     * startScreenShare();
     * ```
     */
    const startScreenShare = useCallback(async (): Promise<void> => {
        try {
            await callNativeAPI<void>('startScreenShare');
        } catch (error) {
            console.error('startScreenShare error:', error);
        }
    }, []);

    /**
     * Stop screen share
     * 
     * @example
     * ```tsx
     * stopScreenShare();
     * ```
     */
    const stopScreenShare = useCallback(async (): Promise<void> => {
        try {
            await callNativeAPI<void>('stopScreenShare');
        } catch (error) {
            console.error('stopScreenShare error:', error);
        }
    }, []);

    return {
        // Microphone-related state - read from global store
        microphoneStatus,
        microphoneLastError,
        hasPublishAudioPermission,
        captureVolume,
        currentMicVolume,

        // Camera-related state - read from global store
        cameraStatus,
        cameraLastError,
        isFrontCamera,
        localMirrorType,  // Key: read from store
        localVideoQuality,

        // Audio output-related state - read from global store
        outputVolume,
        currentAudioRoute,

        // Screen share-related state - read from global store
        screenStatus,

        // Network info state - read from global store
        networkInfo,

        // Methods
        openLocalMicrophone,         // Open local microphone
        closeLocalMicrophone,        // Close local microphone
        setCaptureVolume,            // Set capture volume
        setOutputVolume,             // Set output volume
        setAudioRoute,               // Set audio route
        openLocalCamera,             // Open local camera
        closeLocalCamera,            // Close local camera
        switchCamera,                // Switch camera
        startCameraTest,
        stopCameraTest,
        switchMirror,                // Switch mirror
        updateVideoQuality,          // Update video quality
        startScreenShare,            // Start screen share
        stopScreenShare,             // Stop screen share
    };
}

export function useDeviceState() {
    return useDevice(true);
}

export function useDeviceActions() {
    const {
        openLocalMicrophone,
        closeLocalMicrophone,
        setCaptureVolume,
        setOutputVolume,
        setAudioRoute,
        openLocalCamera,
        closeLocalCamera,
        switchCamera,
        startCameraTest,
        stopCameraTest,
        switchMirror,
        updateVideoQuality,
        startScreenShare,
        stopScreenShare,
    } = useDevice(false);
    return {
        openLocalMicrophone,
        closeLocalMicrophone,
        setCaptureVolume,
        setOutputVolume,
        setAudioRoute,
        openLocalCamera,
        closeLocalCamera,
        switchCamera,
        startCameraTest,
        stopCameraTest,
        switchMirror,
        updateVideoQuality,
        startScreenShare,
        stopScreenShare,
    };
}

export function getDeviceState() {
    const state = deviceStore.getState();
    return {
        microphoneStatus: state.microphoneStatus,
        cameraStatus: state.cameraStatus,
        isFrontCamera: state.isFrontCamera,
    };
}

export default useDeviceState;

