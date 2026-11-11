import AVFoundation
import Foundation
import React

@objc(PermissionModule)
class PermissionModule: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc(getAuthorizationStatus:resolver:rejecter:)
    func getAuthorizationStatus(
        _ kind: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        switch kind {
        case "camera":
            resolve(Self.describe(AVCaptureDevice.authorizationStatus(for: .video)))
        case "microphone":
            resolve(Self.describe(AVCaptureDevice.authorizationStatus(for: .audio)))
        default:
            resolve("not determined")
        }
    }

    private static func describe(_ status: AVAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .denied, .restricted:
            return "denied"
        default:
            return "not determined"
        }
    }
}
