package io.trtc.tuikit.atomicxcore.hybridapi.proxy

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PermissionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return NAME
    }

    companion object {
        const val NAME = "PermissionModule"
    }

    @ReactMethod
    fun getAuthorizationStatus(kind: String, promise: Promise) {
        val permission = when (kind) {
            "camera" -> Manifest.permission.CAMERA
            "microphone" -> Manifest.permission.RECORD_AUDIO
            else -> {
                promise.resolve("not determined")
                return
            }
        }
        val granted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            permission
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(if (granted) "authorized" else "denied")
    }
}
