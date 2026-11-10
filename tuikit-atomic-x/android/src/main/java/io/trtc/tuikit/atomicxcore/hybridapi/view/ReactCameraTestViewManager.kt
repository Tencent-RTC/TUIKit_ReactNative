package io.trtc.tuikit.atomicxcore.hybridapi.view

import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp

class ReactCameraTestViewManager : ViewGroupManager<ReactCameraTestView>() {

    override fun getName(): String {
        return "CameraTestView"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): ReactCameraTestView {
        return ReactCameraTestView(reactContext)
    }

    @ReactProp(name = "viewId")
    fun setViewId(view: ReactCameraTestView, viewId: String?) {
        view.setViewId(viewId)
    }

    @ReactProp(name = "cornerRadius", defaultInt = 0)
    fun setCornerRadius(view: ReactCameraTestView, cornerRadius: Int) {
        view.setCornerRadius(cornerRadius)
    }
}
