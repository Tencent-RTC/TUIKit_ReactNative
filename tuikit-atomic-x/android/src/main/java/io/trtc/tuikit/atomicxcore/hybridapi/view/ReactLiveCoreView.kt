package io.trtc.tuikit.atomicxcore.hybridapi.view

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Outline
import android.net.Uri
import android.util.Log
import android.view.View
import android.view.ViewOutlineProvider
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.imagehelper.ImageSource
import com.facebook.common.references.CloseableReference
import com.facebook.datasource.BaseDataSubscriber
import com.facebook.datasource.DataSource
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.imagepipeline.core.ImagePipeline
import com.facebook.imagepipeline.image.CloseableBitmap
import com.facebook.imagepipeline.image.CloseableImage
import com.facebook.imagepipeline.request.ImageRequest
import com.facebook.imagepipeline.request.ImageRequestBuilder
import com.facebook.common.executors.CallerThreadExecutor
import com.tencent.imsdk.v2.V2TIMManager
import org.json.JSONObject
import io.trtc.tuikit.atomicxcore.api.view.CoreViewType
import io.trtc.tuikit.atomicxcore.api.view.LiveCoreView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.CompletableDeferred

private const val TAG = "ReactLiveCoreView"

class ReactLiveCoreView(context: Context) : ReactFrameLayout(context) {
    private var liveId: String = ""
    private var round: Float = 12.dpToPx(context)
    private var liveCoreView: LiveCoreView? = null
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    init {
        clipToOutline = true
        keepScreenOn = true
        outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, round)
            }
        }
        observeLive()
    }

    fun setCoreViewType(coreViewType: String?) {
        val viewType = parseViewType(coreViewType)
        val view = LiveCoreView(context, null, 0, viewType)
        liveCoreView = view
        addView(view)
        view.setLiveId(liveId)
    }

    fun setLiveId(liveId: String?) {
        this.liveId = liveId ?: ""
    }

    fun setRound(radius: Int) {
        this.round = radius.dpToPx(context)
        invalidateOutline()
    }

    fun setLocalVideoMuteImage(bigImageUri: String?, smallImageUri: String?) {
        Log.d(TAG, "setLocalVideoMuteImage called: bigImageUri=$bigImageUri, smallImageUri=$smallImageUri")

        coroutineScope.launch {
            val bigBitmap = bigImageUri?.let { uri -> loadBitmapFromUri(uri) }
            val smallBitmap = smallImageUri?.let { uri -> loadBitmapFromUri(uri) }

            withContext(Dispatchers.Main) {
                liveCoreView?.setLocalVideoMuteImage(bigBitmap, smallBitmap) ?: run {
                    Log.w(TAG, "setLocalVideoMuteImage: liveCoreView is null, may not be initialized yet")
                }
            }
        }
    }

    private suspend fun loadBitmapFromUri(uri: String): Bitmap? = withContext(Dispatchers.IO) {
        return@withContext try {
            val imageSource = ImageSource(context, uri)
            Log.d(TAG, "loadBitmapFromUri: ImageSource created, uri=${imageSource.uri}, isResource=${imageSource.isResource}")

            val imageRequest = ImageRequestBuilder
                .newBuilderWithSource(imageSource.uri)
                .build()

            val imagePipeline = Fresco.getImagePipeline()
            val dataSource = imagePipeline.fetchDecodedImage(imageRequest, context)

            val deferred = CompletableDeferred<Bitmap?>()
            dataSource.subscribe(object : BaseDataSubscriber<CloseableReference<CloseableImage>>() {
                override fun onNewResultImpl(dataSource: DataSource<CloseableReference<CloseableImage>>) {
                    if (!dataSource.isFinished) return

                    val ref = dataSource.result
                    if (ref != null) {
                        try {
                            val image = ref.get()
                            if (image is CloseableBitmap) {
                                val bitmap = image.underlyingBitmap
                                val config = bitmap.config ?: Bitmap.Config.ARGB_8888
                                val copiedBitmap = bitmap.copy(config, false)
                                deferred.complete(copiedBitmap)
                            } else {
                                deferred.complete(null)
                            }
                        } finally {
                            CloseableReference.closeSafely(ref)
                        }
                    } else {
                        deferred.complete(null)
                    }
                }
                
                override fun onFailureImpl(dataSource: DataSource<CloseableReference<CloseableImage>>) {
                    Log.e(TAG, "Failed to load Bitmap from URI: $uri")
                    deferred.complete(null)
                }
            }, CallerThreadExecutor.getInstance())
            deferred.await()
        } catch (e: Exception) {
            Log.e(TAG, "loadBitmapFromUri: Exception occurred for URI: $uri", e)
            null
        }
    }

    private fun parseViewType(string: String?): CoreViewType {
        if (string == null) {
            return CoreViewType.PLAY_VIEW
        }

        return when (string.lowercase()) {
            "playview" -> CoreViewType.PLAY_VIEW
            "pushview" -> CoreViewType.PUSH_VIEW
            else -> CoreViewType.PLAY_VIEW
        }
    }

    private fun Int.dpToPx(context: Context): Float {
        val density = context.resources.displayMetrics.density
        return this * density
    }

    private fun observeLive() {
        val param = JSONObject().apply {
            put("UIComponentType", 1101)
        }.toString()
        V2TIMManager.getInstance()
            .callExperimentalAPI("reportTUIFeatureUsage", param, null)

    }
}

