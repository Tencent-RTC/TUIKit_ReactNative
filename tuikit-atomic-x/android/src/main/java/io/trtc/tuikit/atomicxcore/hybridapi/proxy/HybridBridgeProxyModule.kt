package io.trtc.tuikit.atomicxcore.hybridapi.proxy

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.tencent.imsdk.v2.V2TIMManager
import io.trtc.tuikit.atomicxcore.hybridapi.bridge.HybridBridge
import io.trtc.tuikit.atomicxcore.hybridapi.json.fromJson

class HybridBridgeProxyModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val mainHandler = Handler(Looper.getMainLooper())

    private val eventEmitter: (String, String) -> Unit = { eventName, paramsJson ->
        sendEvent(eventName, paramsJson)
    }

    private val bridge = HybridBridge(reactContext.applicationContext, eventEmitter)

    override fun getName(): String {
        return NAME
    }

    companion object {
        const val NAME = "HybridBridgeProxy"
    }

    init {
        V2TIMManager.getInstance().callExperimentalAPI("setUIPlatform", 51, null)
    }

    @ReactMethod
    fun callAPI(json: String, promise: Promise) {
        Log.i("Proxy-callAPI", "json: $json")
        mainHandler.post {
            bridge.callAPI(json) { result ->
                mainHandler.post {
                    promise.resolve(result)
                }
            }
        }
    }

    @ReactMethod
    fun addEventListener(key: String) {
        Log.i("Proxy-Listener", "add key: $key")
        mainHandler.post {
            bridge.addListener(key)
        }
    }

    @ReactMethod
    fun removeEventListener(key: String) {
        Log.i("Proxy-Listener", "remove key: $key")
        mainHandler.post {
            bridge.removeListener(key)
        }
    }

    private fun sendEvent(eventName: String, paramsJson: String) {
        if (!reactApplicationContext.hasActiveCatalystInstance()) {
            return
        }
        val paramsMap = paramsJson.fromJson<Map<String, Any>>()
        if (paramsMap == null) {
            Log.e("Proxy-Event-Error", "Failed to parse JSON. eventName: $eventName, paramsJson: $paramsJson")
            return
        }
        val writableMap = mapToWritableMap(paramsMap)
        Log.i("Proxy-Event", "eventName: $eventName params: $writableMap")
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, writableMap)
    }

    private fun mapToWritableMap(map: Map<String, Any>): WritableMap? {
        val writableMap = Arguments.createMap()
        map.forEach { (key, value) ->
            when (value) {
                null -> writableMap.putNull(key)
                is String -> writableMap.putString(key, value)
                is Int -> writableMap.putInt(key, value)
                is Double -> writableMap.putDouble(key, value)
                is Float -> writableMap.putDouble(key, value.toDouble())
                is Boolean -> writableMap.putBoolean(key, value)
                else -> writableMap.putString(key, value.toString())
            }
        }
        return writableMap
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
    }
}

