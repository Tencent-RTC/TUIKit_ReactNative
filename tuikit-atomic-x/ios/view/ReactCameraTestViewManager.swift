import Foundation
import UIKit
import React
import AtomicXCore

@objc(ReactCameraTestViewManager)
class ReactCameraTestViewManager: RCTViewManager {

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func view() -> UIView! {
        return ReactCameraTestView()
    }
}

@objc(ReactCameraTestView)
class ReactCameraTestView: UIView {
    private var _viewId: String = ""
    private var isAttached = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        backgroundColor = .clear
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
            isAttached = true
            registerView()
        } else {
            isAttached = false
            unregisterView()
        }
    }

    @objc
    var viewId: String? {
        didSet {
            let newViewId = viewId ?? ""
            if _viewId == newViewId { return }
            unregisterView()
            _viewId = newViewId
            registerView()
        }
    }

    @objc
    var cornerRadius: NSNumber? {
        didSet {
            let value = CGFloat(cornerRadius?.doubleValue ?? 0)
            layer.cornerRadius = value
            layer.masksToBounds = value > 0
        }
    }

    private func registerView() {
        guard isAttached, !_viewId.isEmpty else { return }
        CameraTestViewManager.shared.register(viewID: _viewId, view: self)
    }

    private func unregisterView() {
        guard !_viewId.isEmpty else { return }
        CameraTestViewManager.shared.unregister(viewID: _viewId)
    }
}
