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
import { callNativeAPI, createStateError } from '../../utils';
import { addListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
    AudioChangerTypeParam,
    AudioReverbTypeParam,
    SetAudioChangerTypeOptions,
    SetAudioReverbTypeOptions,
    SetVoiceEarMonitorEnableOptions,
    VolumeOptions,
} from './types';
import { AudioChangerType, AudioReverbType } from './types';
import { audioEffectStore } from './store';

function findKeyByValue<T extends Record<string, number>>(map: T, value: number): keyof T | null {
    const entry = Object.entries(map).find(([, v]) => v === value);
    return entry ? entry[0] as keyof T : null;
}

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
 * Handle audio effect state change events (module-level, shared by all hook instances)
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
                const updates: {
                    isEarMonitorOpened?: boolean;
                    earMonitorVolume?: number;
                    audioChangerType?: AudioChangerTypeParam;
                    audioReverbType?: AudioReverbTypeParam;
                } = {};

                Object.keys(data).forEach((key) => {
                    if (AUDIO_EFFECT_EVENTS.includes(key)) {
                        const value = data[key];
                        if (key === 'isEarMonitorOpened') {
                            updates.isEarMonitorOpened = typeof value === 'boolean' ? value : Boolean(value);
                        } else if (key === 'earMonitorVolume') {
                            updates.earMonitorVolume = typeof value === 'number' ? value : (Number(value) || 0);
                        } else if (key === 'audioChangerType') {
                            const numValue = typeof value === 'number' ? value : Number(value);
                            const type = findKeyByValue(AudioChangerType, numValue);
                            if (type) {
                                updates.audioChangerType = type;
                            }
                        } else if (key === 'audioReverbType') {
                            const numValue = typeof value === 'number' ? value : Number(value);
                            const type = findKeyByValue(AudioReverbType, numValue);
                            if (type) {
                                updates.audioReverbType = type;
                            }
                        }
                    }
                });

                if (Object.keys(updates).length > 0) {
                    audioEffectStore.setState(updates);
                }
            }
        } catch (error) {
            console.error(`[AudioEffectState] ${eventName} event parse error:`, error);
        }
    };
}

/**
 * Register Native event listeners at module load time (once, never removed)
 */
AUDIO_EFFECT_EVENTS.forEach((eventName) => {
    const keyObject: HybridListenerKey = {
        type: 'state',
        store: 'AudioEffectStore',
        name: eventName,
        roomID: null,
        listenerID: null,
    };
    const key = JSON.stringify(keyObject);
    addListener(key, handleNativeEvent(eventName));
});

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
 *   } = useAudioEffectState();
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
function useAudioEffect(listen: boolean) {
    // Get initial state from global store
    const initialState = audioEffectStore.getState();

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
        if (!listen) return undefined;
        // Subscribe to state changes
        const unsubscribe = audioEffectStore.subscribe((state) => {
            setIsEarMonitorOpened(state.isEarMonitorOpened);
            setEarMonitorVolume(state.earMonitorVolume);
            setAudioChangerTypeState(state.audioChangerType);
            setAudioReverbTypeState(state.audioReverbType);
        });

        return unsubscribe;
    }, [listen]);

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

        const changerTypeValue = AudioChangerType[params.changerType] ?? 0;

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
                const error = createStateError(result, 'Set audio changer type failed');
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

        const reverbTypeValue = AudioReverbType[params.reverbType] ?? 0;

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
                const error = createStateError(result, 'Set audio reverb type failed');
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
                const error = createStateError(result, 'Set voice ear monitor enable failed');
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
                const error = createStateError(result, 'Set voice ear monitor volume failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
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
    };
}

export function useAudioEffectState() {
    return useAudioEffect(true);
}

export function useAudioEffectActions() {
    const { setAudioChangerType, setAudioReverbType, setVoiceEarMonitorEnable, setVoiceEarMonitorVolume } =
        useAudioEffect(false);
    return { setAudioChangerType, setAudioReverbType, setVoiceEarMonitorEnable, setVoiceEarMonitorVolume };
}

export default useAudioEffectState;

