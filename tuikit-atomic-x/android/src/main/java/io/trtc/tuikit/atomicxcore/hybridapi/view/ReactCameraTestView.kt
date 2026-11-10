package io.trtc.tuikit.atomicxcore.hybridapi.view

import android.content.Context
import android.graphics.Outline
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import io.trtc.tuikit.atomicxcore.api.view.CameraView
import io.trtc.tuikit.atomicxcore.hybridapi.api.CameraTestViewManager

class ReactCameraTestView(context: Context) : ReactFrameLayout(context) {
    private var viewId: String = ""
    private var cameraView: CameraView? = null
    private var isAttached = false
    private var cornerRadiusPx: Float = 0f

    init {
        outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, cornerRadiusPx)
            }
        }
        clipToOutline = true
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        isAttached = true
        registerView()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        isAttached = false
        unregisterView()
        removeAllViews()
        cameraView = null
    }

    fun setViewId(viewId: String?) {
        val newViewId = viewId ?: ""
        if (this.viewId == newViewId) return
        unregisterView()
        this.viewId = newViewId
        registerView()
    }

    fun setCornerRadius(radius: Int) {
        cornerRadiusPx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, radius.toFloat(), resources.displayMetrics
        )
        invalidateOutline()
    }

    private fun registerView() {
        if (!isAttached || viewId.isEmpty()) return
        val view = cameraView ?: CameraView(context).also {
            addView(it, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            cameraView = it
        }
        CameraTestViewManager.register(viewId, view)
    }

    private fun unregisterView() {
        if (viewId.isNotEmpty()) {
            CameraTestViewManager.unregister(viewId)
        }
    }
}
