require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "TuikitAtomicX"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://trtc.io.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"
  
  # Dependencies
  s.dependency "AtomicXCore", "3.6.3"
  s.dependency "RTCRoomEngine/Professional", "3.6.3"
  s.dependency "SVGAPlayer", "~> 2.5"
  s.dependency "TXIMSDK_Plus_iOS_XCFramework", "8.9.7511"
  s.dependency "TXLiteAVSDK_Professional", "12.9.20063"

  install_modules_dependencies(s)
end
