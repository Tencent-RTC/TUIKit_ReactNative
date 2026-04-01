import Foundation
import UIKit
import React
import AtomicXCore
import ImSDK_Plus

@objc(LiveCoreViewManager)
class LiveCoreViewManager: RCTViewManager {

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func view() -> UIView! {
        return ReactLiveCoreView()
    }
    
    @objc
    func setLocalVideoMuteImage(_ node: NSNumber, bigImageUri: String?, smallImageUri: String?) {
        guard let bridge = self.bridge else {
            print("LiveCoreViewManager: bridge is nil")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let bigImage = self.loadImage(from: bigImageUri, bridge: bridge)
            let smallImage = self.loadImage(from: smallImageUri, bridge: bridge)

            DispatchQueue.main.async {
                guard let view = bridge.uiManager.view(forReactTag: node) as? ReactLiveCoreView else {
                    print("LiveCoreViewManager: setLocalVideoMuteImage - view not found for node: \(node)")
                    return
                }
                view.setLocalVideoMuteImage(bigImage: bigImage, smallImage: smallImage)
            }
        }
    }
    
    private func loadImage(from uri: String?, bridge: RCTBridge) -> UIImage? {
        guard let uri = uri, !uri.isEmpty else { return nil }

        guard let urlRequest = RCTConvert.nsurlRequest(uri) else {
            print("LiveCoreViewManager: Invalid URI: \(uri)")
            return nil
        }

        let semaphore = DispatchSemaphore(value: 0)
        var resultImage: UIImage?
        
        bridge.imageLoader.loadImage(with: urlRequest) { (error, image) in
            if let error = error {
                print("LiveCoreViewManager: Failed to load image from URI: \(uri), error: \(error)")
            } else if let img = image {
                resultImage = img
            }
            semaphore.signal()
        }
        
        semaphore.wait()
        return resultImage
    }
}

@objc(ReactLiveCoreView)
class ReactLiveCoreView: UIView {
    private var _liveId: String = ""
    private var _round: CGFloat = 12.0
    private var liveCoreView: LiveCoreView?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .black
        setupCornerRadius()
        observeLive()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        backgroundColor = .black
        setupCornerRadius()
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        updateCornerRadius()
    }
    
    override func didMoveToSuperview() {
        super.didMoveToSuperview()
        
        if superview != nil {
            UIApplication.shared.isIdleTimerDisabled = true
        } else {
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }
    
    @objc
    var coreViewType: String? {
        didSet {
            let viewType = parseViewType(coreViewType)
            let view = LiveCoreView(viewType: viewType, frame: bounds)
            view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(view)
            liveCoreView = view
            view.setLiveID(_liveId)
        }
    }
    
    @objc
    var liveId: String? {
        didSet {
            _liveId = liveId ?? ""
        }
    }
    
    @objc
    var round: NSNumber? {
        didSet {
            if let roundValue = round?.intValue, roundValue >= 0 {
                _round = CGFloat(roundValue)
                updateCornerRadius()
            }
        }
    }
    
    private func setupCornerRadius() {
        layer.masksToBounds = true
        updateCornerRadius()
    }
    
    private func updateCornerRadius() {
        layer.cornerRadius = _round
    }
    
    func setLocalVideoMuteImage(bigImage: UIImage?, smallImage: UIImage?) {
        liveCoreView?.setLocalVideoMuteImage(bigImage: bigImage, smallImage: smallImage)
    }
    
    private func parseViewType(_ string: String?) -> CoreViewType {
        guard let string = string else { return .playView }
        switch string.lowercased() {
        case "playview":
            return .playView
        case "pushview":
            return .pushView
        default:
            return .playView
        }
    }

    private func observeLive() {
        let dictParam: [String: Any] = [
            "UIComponentType": 1101
        ]

        guard let dataParam = try? JSONSerialization.data(withJSONObject: dictParam, options: []),
              let strParam = String(data: dataParam, encoding: .utf8)
        else {
            return
        }

        V2TIMManager.sharedInstance().callExperimentalAPI(
            api: "reportTUIFeatureUsage",
            param: strParam as NSObject,
            succ: { _ in },
            fail: { _, _ in }
        )
    }
}

