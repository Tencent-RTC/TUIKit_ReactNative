import UIKit
import SVGAPlayer
import React

@objc(SVGAAnimationView)
class SVGAAnimationView: UIView {
    private var playerView: SVGAPlayer?
    @objc var onFinished: RCTDirectEventBlock?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        backgroundColor = .clear
    }
    
    private func cleanupOldPlayer() {
        playerView?.removeFromSuperview()
        playerView?.delegate = nil
        playerView = nil
    }
    
    private func cleanup() {
        playerView?.stopAnimation()
        cleanupOldPlayer()
    }
    
    private func sendOnFinishedEvent() {
        guard let onFinished = onFinished else { return }
        onFinished([:])
    }
    
    @objc
    func startAnimation(_ playUrl: String) {
        print("SVGAAnimationView: startAnimation playUrl: \(playUrl)")
        
        if playUrl.isEmpty {
            print("SVGAAnimationView: startAnimation, playUrl is empty")
            sendOnFinishedEvent()
            return
        }
        
        cleanupOldPlayer()
        
        let player = SVGAPlayer(frame: bounds)
        player.contentMode = .scaleAspectFill
        player.delegate = self
        player.loops = 1
        addSubview(player)
    
        player.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            player.leadingAnchor.constraint(equalTo: leadingAnchor),
            player.trailingAnchor.constraint(equalTo: trailingAnchor),
            player.topAnchor.constraint(equalTo: topAnchor),
            player.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        
        self.playerView = player
        
        // 异步加载并播放动画
        DispatchQueue.global().async { [weak self] in
            guard let self = self else { return }
            let url: URL?
            
            if playUrl.hasPrefix("http://") || playUrl.hasPrefix("https://") {
                url = URL(string: playUrl)
            } else {
                url = URL(fileURLWithPath: playUrl)
            }
            
            guard let validUrl = url else {
                DispatchQueue.main.async {
                    self.sendOnFinishedEvent()
                }
                return
            }
            
            // 加载数据
            var animationData: Data?
            do {
                animationData = try Data(contentsOf: validUrl)
            } catch {
                DispatchQueue.main.async {
                    self.sendOnFinishedEvent()
                }
                return
            }
            
            guard let data = animationData else {
                DispatchQueue.main.async {
                    self.sendOnFinishedEvent()
                }
                return
            }
            
            let parser = SVGAParser()
            parser.parse(with: data, cacheKey: validUrl.lastPathComponent) { [weak self] videoItem in
                DispatchQueue.main.async {
                    guard let self = self else { return }
                    print("SVGAAnimationView: startAnimation begin")
                    self.playerView?.videoItem = videoItem
                    self.playerView?.startAnimation()
                }
            } failureBlock: { [weak self] error in
                DispatchQueue.main.async {
                    self?.sendOnFinishedEvent()
                }
            }
        }
    }
    
    @objc
    func stopAnimation() {
        cleanup()
    }
}

// MARK: - SVGAPlayerDelegate
extension SVGAAnimationView: SVGAPlayerDelegate {
    func svgaPlayerDidFinishedAnimation(_ player: SVGAPlayer) {
        print("SVGAAnimationView: onFinished")
        playerView?.isHidden = true
        cleanup()
        sendOnFinishedEvent()
    }
}
