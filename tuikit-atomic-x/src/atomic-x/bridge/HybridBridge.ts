import { NativeEventEmitter, NativeModules } from 'react-native';

const { HybridBridgeProxy } = NativeModules;

export type HybridRequest = {
    api: string;
    params?: Record<string, unknown>;
};

export type HybridResponse = {
    api: string;
    code: number;
    message?: string;
    data?: unknown;
};

export type HybridListenerKey = {
    type: string;
    store: string;
    name: string;
    roomID: string | null;
    listenerID?: string | null;
};

export type HybridEvent = {
    key: string;
    data: string;
};

let sharedEmitter: NativeEventEmitter | null = null;

const subscriptionMap = new Map<string, { remove: () => void }>();

export function callAPI(request: HybridRequest): Promise<HybridResponse> {
    if (!HybridBridgeProxy) {
        return Promise.reject(new Error('HybridBridgeProxy is not available'));
    }

    const requestJson = JSON.stringify(request);
    return HybridBridgeProxy.callAPI(requestJson)
        .then((json: string) => {
            if (!json || typeof json !== 'string') {
                throw new Error(`Invalid response: expected string, got ${typeof json}`);
            }
            try {
                const response = JSON.parse(json) as HybridResponse;
                return response;
            } catch (parseError: any) {
                throw new Error(`Failed to parse response JSON: ${parseError?.message || 'Unknown error'}`);
            }
        });
}

export function callExperimentalAPI(json: string): Promise<string> {
    if (!HybridBridgeProxy) {
        return Promise.reject(new Error('HybridBridgeProxy is not available'));
    }
    return HybridBridgeProxy.callExperimentalAPI(json).then((result: unknown) =>
        typeof result === 'string' ? result : ''
    );
}

export function addListener(key: string, listener?: (event: any) => void): { remove: () => void } | void {
    if (!HybridBridgeProxy) {
        return;
    }

    if (listener) {
        const emitter = getEventEmitter();
        const subscription = emitter.addListener(key, listener);

        const existingSubscription = subscriptionMap.get(key);
        if (existingSubscription) {
            existingSubscription.remove();
        }
        subscriptionMap.set(key, subscription);
    }

    HybridBridgeProxy.addEventListener(key);
}

export function removeListener(key: string): void {
    if (!HybridBridgeProxy) {
        return;
    }

    const subscription = subscriptionMap.get(key);
    if (subscription) {
        subscription.remove();
        subscriptionMap.delete(key);
    }

    HybridBridgeProxy.removeEventListener(key);
}

function getEventEmitter(): NativeEventEmitter {
    if (!HybridBridgeProxy) {
        throw new Error('HybridBridgeProxy is not available');
    }
    if (!sharedEmitter) {
        sharedEmitter = new NativeEventEmitter(HybridBridgeProxy);
    }
    return sharedEmitter;
}


