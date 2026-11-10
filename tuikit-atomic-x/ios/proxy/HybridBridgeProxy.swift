import Foundation
import React
import AtomicXCore
import ImSDK_Plus
import RTCRoomEngine

@objc(HybridBridgeProxy)
class HybridBridgeProxy: NSObject {
    private var hybridBridge: HybridBridge?
    private var jsEventNames: [NSDictionary: String] = [:]
    private let jsEventNamesLock = NSLock()
    @objc var bridge: RCTBridge!
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    override init() {
        super.init()
        V2TIMManager.sharedInstance().callExperimentalAPI(
            api: "setUIPlatform",
            param: NSNumber(value: 51),
            succ: { _ in },
            fail: { _, _ in }
        )
    }

    @objc
    func callAPI(_ json: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        print("[Proxy-callAPI] json: \(json)")
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.getHybridBridge().callAPI(json: json) { result in
                DispatchQueue.main.async {
                    resolver(result)
                }
            }
        }
    }
    
    // HybridBridge has no callExperimentalAPI route; call the engine directly like uniapp's ExperimentalApiInvoker.
    @objc
    func callExperimentalAPI(_ json: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        print("[Proxy-callExperimentalAPI] json: \(json)")
        DispatchQueue.main.async {
            TUIRoomEngine.sharedInstance().callExperimentalAPI(jsonStr: json) { result in
                DispatchQueue.main.async {
                    resolver(result)
                }
            }
        }
    }

    @objc(addEventListener:)
    func addEventListener(_ key: String) {
        print("[Proxy-Listener] add key: \(key)")
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let identity = Self.listenerIdentity(key) {
                self.jsEventNamesLock.lock()
                self.jsEventNames[identity] = key
                self.jsEventNamesLock.unlock()
            }
            self.getHybridBridge().addListener(key)
        }
    }
    
    @objc(removeEventListener:)
    func removeEventListener(_ key: String) {
        print("[Proxy-Listener] remove key: \(key)")
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let identity = Self.listenerIdentity(key) {
                self.jsEventNamesLock.lock()
                self.jsEventNames.removeValue(forKey: identity)
                self.jsEventNamesLock.unlock()
            }
            self.getHybridBridge().removeListener(key)
        }
    }

    // Native re-serializes the key (reordered fields, added "params":null), so JS-registered names are matched by content.
    private static func listenerIdentity(_ key: String) -> NSDictionary? {
        guard let data = key.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return object.filter { !($0.value is NSNull) } as NSDictionary
    }

    private func jsEventName(for eventName: String) -> String {
        guard let identity = Self.listenerIdentity(eventName) else { return eventName }
        jsEventNamesLock.lock()
        defer { jsEventNamesLock.unlock() }
        return jsEventNames[identity] ?? eventName
    }

    private func getHybridBridge() -> HybridBridge {
        if hybridBridge == nil {
            let eventEmitter: (String, String) -> Void = { [weak self] eventName, paramsJson in
                guard let self = self, let bridge = self.bridge else { return }
                guard let jsonData = paramsJson.data(using: .utf8) else {
                    print("[Proxy-Event-Error] Failed to convert paramsJson to Data. eventName: \(eventName), paramsJson: \(paramsJson)")
                    return
                }
                guard let params = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
                    print("[Proxy-Event-Error] Failed to parse JSON. eventName: \(eventName), paramsJson: \(paramsJson)")
                    return
                }
                bridge.eventDispatcher().sendDeviceEvent(withName: self.jsEventName(for: eventName), body: params)
            }
            hybridBridge = HybridBridge(eventEmitter: eventEmitter)
        }
        return hybridBridge!
    }
}
