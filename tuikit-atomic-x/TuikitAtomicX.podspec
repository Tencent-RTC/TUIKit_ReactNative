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
  s.exclude_files = "ios/view/SVGAPlayer/pbobjc/**"
  s.public_header_files = "ios/view/SVGAPlayer/*.h"
  s.private_header_files = "ios/TuikitAtomicX.h"

  # SVGAPlayer pbobjc files must be compiled without ARC
  s.subspec 'SVGAProto' do |ss|
    ss.source_files = "ios/view/SVGAPlayer/pbobjc/*.{h,m}"
    ss.requires_arc = false
    ss.pod_target_xcconfig = {
      'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) GPB_USE_PROTOBUF_FRAMEWORK_IMPORTS=1',
    }
  end

  # Dependencies
  s.dependency "AtomicXCore", "4.3.11"
  s.dependency "RTCRoomEngine/Professional", "4.3.11"
  s.dependency "Protobuf", "3.22.1"
  s.dependency "SSZipArchive"
  s.dependency "TXIMSDK_Plus_iOS_XCFramework", "9.0.7661"
  s.dependency "TXLiteAVSDK_Professional", "13.5.21355"

  s.frameworks = "AVFoundation"
  s.library = "z"

  install_modules_dependencies(s)
end
