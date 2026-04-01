/**
 * @module AudioEffectState
 * @module_description
 * Audio Effect Management Module
 * Core Features: Provides advanced audio effects including voice changer, reverb, ear monitor, supporting multiple effect types and real-time audio adjustment.
 * Technical Highlights: Based on audio processing algorithms, supports real-time effect processing, low-latency audio transmission, and audio quality optimization.
 * Business Value: Provides differentiated audio experience for live streaming platforms, enhancing user engagement and entertainment.
 * Application Scenarios: Voice-changing live streaming, karaoke streaming, audio entertainment, professional audio effects, and other scenarios requiring audio processing.
 */

import { useState, useEffect, useCallback } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
    AudioChangerTypeParam,
    AudioReverbTypeParam,
    SetAudioChangerTypeOptions,
    SetAudioReverbTypeOptions,
    SetVoiceEarMonitorEnableOptions,
    VolumeOptions,
} from './types';
import { audioEffectStore } from './store';

/**
 * Audio effect listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Voice changer type mapping table
 */
const CHANGER_TYPE_MAP: Record<number, AudioChangerTypeParam> = {
    0: 'NONE',
    1: 'CHILD',
    2: 'LITTLE_GIRL',
    3: 'MAN',
    4: 'HEAVY_METAL',
    5: 'COLD',
    6: 'FOREIGNER',
    7: 'TRAPPED_BEAST',
    8: 'FATSO',
    9: 'STRONG_CURRENT',
    10: 'HEAVY_MACHINERY',
    11: 'ETHEREAL',
} as const;

/**
 * Reverb type mapping table
 */
const REVERB_TYPE_MAP: Record<number, AudioReverbTypeParam> = {
    0: 'NONE',
    1: 'KTV',
    2: 'SMALL_ROOM',
    3: 'AUDITORIUM',
    4: 'DEEP',
    5: 'LOUD',
    6: 'METALLIC',
    7: 'MAGNETIC',
} as const;

/**
 * Audio effect state event name constants
 */
const AUDIO_EFFECT_EVENTS = [
    'isEarMonitorOpened',
    'earMonitorVolume',
    'audioChangerType',
    'audioReverbType',
];

/**
 * Safe JSON parse
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

/**
 * Voice changer type string to number reverse mapping
 */
const CHANGER_TYPE_STRING_MAP: Record<string, number> = {
    'NONE': 0,
    'CHILD': 1,
    'LITTLE_GIRL': 2,
    'MAN': 3,
    'HEAVY_METAL': 4,
    'COLD': 5,
    'FOREIGNER': 6,
    'TRAPPED_BEAST': 7,
    'FATSO': 8,
    'STRONG_CURRENT': 9,
    'HEAVY_MACHINERY': 10,
    'ETHEREAL': 11,
};

/**
 * Reverb type string to number reverse mapping
 */
const REVERB_TYPE_STRING_MAP: Record<string, number> = {
    'NONE': 0,
    'KTV': 1,
    'SMALL_ROOM': 2,
    'AUDITORIUM': 3,
    'DEEP': 4,
    'LOUD': 5,
    'METALLIC': 6,
    'MAGNETIC': 7,
};

/**
 * Map voice changer type code to voice changer type
 */
function mapChangerTypeCodeToChangerType(typeCode: number): AudioChangerTypeParam | null {
    const mappedType = CHANGER_TYPE_MAP[typeCode];
    if (mappedType === undefined) {
        console.warn(`Unknown changer type code: ${typeCode}`);
        return null;
    }
    return mappedType;
}

/**
 * Map reverb type code to reverb type
 */
function mapReverbTypeCodeToReverbType(typeCode: number): AudioReverbTypeParam | null {
    const mappedType = REVERB_TYPE_MAP[typeCode];
    if (mappedType === undefined) {
        console.warn(`Unknown reverb type code: ${typeCode}`);
        return null;
    }
    return mappedType;
}

/**
 * AudioEffectState Hook
 * 
 * @example
 * ```tsx
 * import { useAudioEffectState } from '@/src/atomic-x/state/AudioEffectState';
 * 
 * function AudioEffectComponent() {
 *   const { 
 *     audioChangerType,
 *     audioReverbType,
 *     isEarMonitorOpened,
 *     setAudioChangerType,
 *     setAudioReverbType 
 *   } = useAudioEffectState('your_live_id');
 * 
 *   const handleSetChangerType = async () => {
 *     await setAudioChangerType({
 *       changerType: 'MAN',
 *       onSuccess: () => console.log('Set successfully'),
 *       onError: (error) => console.error('Set failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       <Text>Current Voice Changer Type: {audioChangerType}</Text>
 *       <Text>Current Reverb Type: {audioReverbType}</Text>
 *       <Button onPress={handleSetChangerType} title="Set Voice Changer" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useAudioEffectState(liveID: string) {
    // Get initial state from global store
    const initialState = audioEffectStore.getState(liveID);

    /**
     * Ear monitor switch state
     * @type {boolean}
     * @description Controls whether to enable ear monitor function, true for enabled, false for disabled
     * @default Get initial value from global store
     */
    const [isEarMonitorOpened, setIsEarMonitorOpened] = useState<boolean>(initialState.isEarMonitorOpened);

    /**
     * Ear monitor volume level
     * @type {number}
     * @description Volume level of ear monitor function, used to adjust ear monitor sound level
     * @default Get initial value from global store
     */
    const [earMonitorVolume, setEarMonitorVolume] = useState<number>(initialState.earMonitorVolume);

    /**
     * Voice changer type
     * @type {AudioChangerTypeParam}
     * @description Current applied voice changer effect type, supports multiple voice effects (e.g., male voice, female voice, metallic, etc.)
     * @default Get initial value from global store
     */
    const [audioChangerType, setAudioChangerTypeState] = useState<AudioChangerTypeParam>(initialState.audioChangerType);

    /**
     * Reverb type
     * @type {AudioReverbTypeParam}
     * @description Current applied reverb effect type, supports multiple reverb effects (e.g., KTV, auditorium, deep, etc.)
     * @default Get initial value from global store
     */
    const [audioReverbType, setAudioReverbTypeState] = useState<AudioReverbTypeParam>(initialState.audioReverbType);

    // Subscribe to global store state changes
    useEffect(() => {
        if (!liveID) {
            return;
        }

        // Subscribe to state changes
        const unsubscribe = audioEffectStore.subscribe(liveID, (state) => {
            setIsEarMonitorOpened(state.isEarMonitorOpened);
            setEarMonitorVolume(state.earMonitorVolume);
            setAudioChangerTypeState(state.audioChangerType);
            setAudioReverbTypeState(state.audioReverbType);
        });

        // Clean up subscription
        return unsubscribe;
    }, [liveID]);

    // Event listener references
    type WritableMap = Record<string, unknown>;

    /**
     * Handle audio effect state change events
     * Update global store, store will automatically notify all subscribers
     */
    const handleEvent = useCallback((eventName: string) => (event: WritableMap) => {
        try {
            // If event is already an object, use it directly; otherwise try to parse
            const data = event && typeof event === 'object' && !Array.isArray(event)
                ? event
                : typeof event === 'string'
                    ? JSON.parse(event)
                    : event;

            console.log(`[AudioEffectState] ${eventName} event received:`, JSON.stringify(data));

            // Check if data's keys match any values in AUDIO_EFFECT_EVENTS
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                const updates: {
                    isEarMonitorOpened?: boolean;
                    earMonitorVolume?: number;
                    audioChangerType?: AudioChangerTypeParam;
                    audioReverbType?: AudioReverbTypeParam;
                } = {};

                Object.keys(data).forEach((key) => {
                    if (AUDIO_EFFECT_EVENTS.includes(key)) {
                        const value = data[key];

                        // Update corresponding reactive data based on different keys
                        if (key === 'isEarMonitorOpened') {
                            const parsedData = typeof value === 'boolean' ? value : Boolean(value);
                            updates.isEarMonitorOpened = parsedData;
                        } else if (key === 'earMonitorVolume') {
                            // earMonitorVolume is number type
                            const parsedData = typeof value === 'number' ? value : (Number(value) || 0);
                            updates.earMonitorVolume = parsedData;
                        } else if (key === 'audioChangerType') {
                            // audioChangerType needs to be mapped from type code
                            let type: AudioChangerTypeParam | null = null;
                            
                            if (typeof value === 'number') {
                                type = mapChangerTypeCodeToChangerType(value);
                            } else if (typeof value === 'string') {
                                // Try to match directly as string type first
                                if (CHANGER_TYPE_STRING_MAP[value] !== undefined) {
                                    type = value as AudioChangerTypeParam;
                                } else {
                                    // Try to parse as number
                                    const numValue = parseInt(value, 10);
                                    if (!isNaN(numValue)) {
                                        type = mapChangerTypeCodeToChangerType(numValue);
                                    }
                                }
                            }
                            
                            console.log('audioChangerType', type);
                            if (type) {
                                updates.audioChangerType = type;
                            } else {
                                console.error(`Invalid changer type received: ${value}`);
                            }
                        } else if (key === 'audioReverbType') {
                            // audioReverbType needs to be mapped from type code
                            let type: AudioReverbTypeParam | null = null;
                            
                            if (typeof value === 'number') {
                                type = mapReverbTypeCodeToReverbType(value);
                            } else if (typeof value === 'string') {
                                // Try to match directly as string type first
                                if (REVERB_TYPE_STRING_MAP[value] !== undefined) {
                                    type = value as AudioReverbTypeParam;
                                } else {
                                    // Try to parse as number
                                    const numValue = parseInt(value, 10);
                                    if (!isNaN(numValue)) {
                                        type = mapReverbTypeCodeToReverbType(numValue);
                                    }
                                }
                            }
                            
                            console.log('audioReverbType', type);
                            if (type) {
                                updates.audioReverbType = type;
                            } else {
                                console.error(`Invalid reverb type received: ${value}`);
                            }
                        }
                    }
                });

                // Batch update global store (only update once to avoid multiple notifications)
                if (Object.keys(updates).length > 0) {
                    audioEffectStore.setState(liveID, updates);
                }
            }
        } catch (error) {
            console.error(`[AudioEffectState] ${eventName} event parse error:`, error);
            console.log(`[AudioEffectState] ${eventName} event received (raw):`, event);
        }
    }, [liveID]);

    /**
     * Bind event listeners
     */
    useEffect(() => {
        const createListenerKeyObject = (eventName: string, listenerID?: string | null): HybridListenerKey => {
            return {
                type: 'state',
                store: 'AudioEffectStore',
                name: eventName,
                roomID: null,
                listenerID: listenerID ?? null,
            };
        };

        // Save listener cleanup function references
        const cleanupFunctions: Array<{ remove: () => void }> = [];

        AUDIO_EFFECT_EVENTS.forEach((eventName) => {
            const keyObject = createListenerKeyObject(eventName);
            const key = JSON.stringify(keyObject);
            console.log(key);
            // addListener will automatically register Native and JS layer event listeners
            const subscription = addListener(key, handleEvent(eventName));
            if (subscription) {
                cleanupFunctions.push(subscription);
            }

            console.log(`[AudioEffectState] Added listener for: ${eventName}, eventName=${key}`);
        });

        return () => {
            AUDIO_EFFECT_EVENTS.forEach((eventName) => {
                const keyObject = createListenerKeyObject(eventName);
                const key = JSON.stringify(keyObject);
                removeListener(key);
            });
            // Also clean up JS layer subscriptions
            cleanupFunctions.forEach((cleanup) => {
                cleanup.remove();
            });
        };
    }, [handleEvent]);

    /**
     * Set voice changer effect
     
     * 
     * @param params - Voice changer effect parameters
     * @example
     * ```tsx
     * await setAudioChangerType({
     *   changerType: 'MAN',
     *   onSuccess: () => console.log('Set successfully'),
     *   onError: (error) => console.error('Set failed:', error)
     * });
     * ```
     */
    const setAudioChangerType = useCallback(async (params: SetAudioChangerTypeOptions): Promise<void> => {
        // Validate required parameters
        if (!params.changerType) {
            const error = new Error('Missing required parameter: changerType');
            params.onError?.(error);
            return;
        }

        const changerTypeValue = CHANGER_TYPE_STRING_MAP[params.changerType] ?? 0;

        const { onSuccess, onError, changerType, ...otherParams } = params;
        const changerParams = {
            ...otherParams,
            changerType: changerTypeValue,
        };

        try {
            const result = await callNativeAPI<void>('setAudioChangerType', changerParams);

            if (result.success) {
                // Only trigger callback on success, state update handled by event listener
                onSuccess?.();
            } else {
                const error = new Error(result.error || 'Set audio changer type failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Set reverb effect
     * 
     * @param params - Reverb effect parameters
     * @example
     * ```tsx
     * await setAudioReverbType({
     *   reverbType: 'KTV',
     *   onSuccess: () => console.log('Set successfully'),
     *   onError: (error) => console.error('Set failed:', error)
     * });
     * ```
     */
    const setAudioReverbType = useCallback(async (params: SetAudioReverbTypeOptions): Promise<void> => {
        // Validate required parameters
        if (!params.reverbType) {
            const error = new Error('Missing required parameter: reverbType');
            params.onError?.(error);
            return;
        }

        const reverbTypeValue = REVERB_TYPE_STRING_MAP[params.reverbType] ?? 0;

        const { onSuccess, onError, reverbType, ...otherParams } = params;
        const reverbParams = {
            ...otherParams,
            reverbType: reverbTypeValue,
        };

        try {
            const result = await callNativeAPI<void>('setAudioReverbType', reverbParams);

            if (result.success) {
                // Only trigger callback on success, state update handled by event listener
                onSuccess?.();
            } else {
                const error = new Error(result.error || 'Set audio reverb type failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Set ear monitor switch state
     * 
     * @param params - Ear monitor switch parameters
     * @example
     * ```tsx
     * await setVoiceEarMonitorEnable({
     *   enable: true,
     *   onSuccess: () => console.log('Set successfully'),
     *   onError: (error) => console.error('Set failed:', error)
     * });
     * ```
     */
    const setVoiceEarMonitorEnable = useCallback(async (params: SetVoiceEarMonitorEnableOptions): Promise<void> => {
        // Validate required parameters
        if (params.enable === undefined) {
            const error = new Error('Missing required parameter: enable');
            params.onError?.(error);
            return;
        }

        const { onSuccess, onError, ...enableParams } = params;

        try {
            const result = await callNativeAPI<void>('setVoiceEarMonitorEnable', enableParams);

            if (result.success) {
                // Only trigger callback on success, state update handled by event listener
                onSuccess?.();
            } else {
                const error = new Error(result.error || 'Set voice ear monitor enable failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Set ear monitor volume level
     * 
     * @param params - Ear monitor volume parameters
     * @example
     * ```tsx
     * await setVoiceEarMonitorVolume({
     *   volume: 50,
     *   onSuccess: () => console.log('Set successfully'),
     *   onError: (error) => console.error('Set failed:', error)
     * });
     * ```
     */
    const setVoiceEarMonitorVolume = useCallback(async (params: VolumeOptions): Promise<void> => {
        // Validate required parameters
        if (params.volume === undefined) {
            const error = new Error('Missing required parameter: volume');
            params.onError?.(error);
            return;
        }

        const { onSuccess, onError, ...volumeParams } = params;

        try {
            const result = await callNativeAPI<void>('setVoiceEarMonitorVolume', volumeParams);

            if (result.success) {
                // Only trigger callback on success, state update handled by event listener
                onSuccess?.();
            } else {
                const error = new Error(result.error || 'Set voice ear monitor volume failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Add audio effect event listener
     *
     * @param eventName - Event name
     * @param listener - Event callback function
     * @param listenerID - Listener ID (optional)
     * @example
     * ```tsx
     * addAudioEffectListener('onAudioEffectChanged', (params) => {
     *   console.log('Audio effect changed:', params);
     * });
     * ```
     */
    const addAudioEffectListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
        const createListenerKeyObject: HybridListenerKey = {
            type: 'state',
            store: 'AudioEffectStore',
            name: eventName,
            roomID: null,
            listenerID: listenerID ?? null,
        };
        addListener(JSON.stringify(createListenerKeyObject), listener);
    }, []);

    /**
     * Remove audio effect event listener
     *
     * @param eventName - Event name
     * @param listenerID - Listener ID (optional)
     * @example
     * ```tsx
     * removeAudioEffectListener('onAudioEffectChanged');
     * ```
     */
    const removeAudioEffectListener = useCallback((eventName: string, listenerID?: string): void => {
        const createListenerKeyObject: HybridListenerKey = {
            type: 'state',
            store: 'AudioEffectStore',
            name: eventName,
            roomID: null,
            listenerID: listenerID ?? null,
        };
        removeListener(JSON.stringify(createListenerKeyObject));
    }, []);

    return {
        audioChangerType,          // Voice changer state
        audioReverbType,           // Reverb state
        isEarMonitorOpened,        // Ear monitor switch state
        earMonitorVolume,          // Ear monitor volume level
        setAudioChangerType,       // Set voice changer effect
        setAudioReverbType,        // Set reverb effect
        setVoiceEarMonitorEnable,  // Set ear monitor switch
        setVoiceEarMonitorVolume,  // Set ear monitor volume
        addAudioEffectListener,    // Add audio effect event listener
        removeAudioEffectListener, // Remove audio effect event listener
    };
}

export default useAudioEffectState;

