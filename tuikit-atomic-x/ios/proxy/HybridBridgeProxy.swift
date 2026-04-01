import Foundation
import React
import AtomicXCore
import ImSDK_Plus

@objc(HybridBridgeProxy)
class HybridBridgeProxy: NSObject {
    private var hybridBridge: HybridBridge?
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
    
    @objc(addEventListener:)
    func addEventListener(_ key: String) {
        print("[Proxy-Listener] add key: \(key)")
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.getHybridBridge().addListener(key)
        }
    }
    
    @objc(removeEventListener:)
    func removeEventListener(_ key: String) {
        print("[Proxy-Listener] remove key: \(key)")
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.getHybridBridge().removeListener(key)
        }
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
                print("[Proxy-Event] eventName: \(eventName)  params: \(params)")
                bridge.eventDispatcher().sendDeviceEvent(withName: eventName, body: params)
            }
            hybridBridge = HybridBridge(eventEmitter: eventEmitter)
        }
        return hybridBridge!
    }
}
