package io.trtc.tuikit.atomicxcore.hybridapi.view

import android.content.Context
import android.view.Choreographer
import android.view.View
import android.view.View.MeasureSpec
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.modules.core.ReactChoreographer

open class ReactFrameLayout(context: Context) : FrameLayout(context) {

    private var layoutEnqueued = false

    private val layoutCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            layoutEnqueued = false
            forceLayoutTree(this@ReactFrameLayout)
            measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
            )
            layout(left, top, right, bottom)
            if (hasPendingLayout(this@ReactFrameLayout)) {
                requestLayout()
            }
        }
    }

    override fun requestLayout() {
        super.requestLayout()
        if (!layoutEnqueued && layoutCallback != null) {
            layoutEnqueued = true
            ReactChoreographer.getInstance().postFrameCallback(
                ReactChoreographer.CallbackType.NATIVE_ANIMATED_MODULE,
                layoutCallback
            )
        }
    }

    private fun forceLayoutTree(view: View) {
        view.forceLayout()
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                forceLayoutTree(view.getChildAt(i))
            }
        }
    }

    private fun hasPendingLayout(view: View): Boolean {
        if (view !== this && view.isLayoutRequested) return true
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                if (hasPendingLayout(view.getChildAt(i))) return true
            }
        }
        return false
    }
}
