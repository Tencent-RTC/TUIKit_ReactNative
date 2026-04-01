package io.trtc.tuikit.atomicxcore.hybridapi

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import io.trtc.tuikit.atomicxcore.hybridapi.proxy.ForegroundServiceModule
import io.trtc.tuikit.atomicxcore.hybridapi.proxy.HybridBridgeProxyModule
import io.trtc.tuikit.atomicxcore.hybridapi.view.LiveCoreViewManager
import io.trtc.tuikit.atomicxcore.hybridapi.view.SVGAAnimationViewManager
import java.util.HashMap

class TuikitAtomicXPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      TuikitAtomicXModule.NAME -> TuikitAtomicXModule(reactContext)
      HybridBridgeProxyModule.NAME -> HybridBridgeProxyModule(reactContext)
      ForegroundServiceModule.NAME -> ForegroundServiceModule(reactContext)
      else -> null
    }
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return listOf(
      LiveCoreViewManager(),
      SVGAAnimationViewManager()
    )
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      moduleInfos[TuikitAtomicXModule.NAME] = ReactModuleInfo(
        TuikitAtomicXModule.NAME,
        TuikitAtomicXModule.NAME,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        false,  // isCxxModule
        true // isTurboModule
      )
      moduleInfos[HybridBridgeProxyModule.NAME] = ReactModuleInfo(
        HybridBridgeProxyModule.NAME,
        HybridBridgeProxyModule.NAME,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        false,  // isCxxModule
        false // isTurboModule (HybridBridgeProxy is not a TurboModule)
      )
      moduleInfos[ForegroundServiceModule.NAME] = ReactModuleInfo(
        ForegroundServiceModule.NAME,
        ForegroundServiceModule.NAME,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        false,  // isCxxModule
        false // isTurboModule (ForegroundServiceModule is not a TurboModule)
      )
      moduleInfos
    }
  }
}
