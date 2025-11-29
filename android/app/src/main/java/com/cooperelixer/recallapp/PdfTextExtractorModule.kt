package com.cooperelixer.recallapp

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.File
import java.io.FileInputStream
import java.io.InputStream

class PdfTextExtractorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        // Initialize PDFBox resources
        PDFBoxResourceLoader.init(reactContext)
    }

    override fun getName(): String {
        return "PdfTextExtractor"
    }

    @ReactMethod
    fun extractText(uriString: String, maxChars: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            var inputStream: InputStream? = null
            var tempFile: File? = null

            try {
                // Handle different URI types
                inputStream = when {
                    uriString.startsWith("content://") -> {
                        val uri = Uri.parse(uriString)
                        context.contentResolver.openInputStream(uri)
                    }
                    uriString.startsWith("file://") -> {
                        FileInputStream(File(uriString.removePrefix("file://")))
                    }
                    uriString.startsWith("/") -> {
                        FileInputStream(File(uriString))
                    }
                    else -> {
                        promise.reject("INVALID_URI", "Invalid URI format: $uriString")
                        return
                    }
                }

                if (inputStream == null) {
                    promise.reject("OPEN_FAILED", "Could not open file: $uriString")
                    return
                }

                // Load PDF document
                val document = PDDocument.load(inputStream)
                
                try {
                    val stripper = PDFTextStripper()
                    
                    // Extract text from all pages
                    val fullText = stripper.getText(document)
                    
                    // Clean up the text
                    val cleanedText = fullText
                        .replace(Regex("\\s+"), " ")  // Normalize whitespace
                        .trim()
                    
                    // Truncate if needed
                    val resultText = if (cleanedText.length > maxChars) {
                        cleanedText.substring(0, maxChars) + "..."
                    } else {
                        cleanedText
                    }
                    
                    promise.resolve(resultText)
                } finally {
                    document.close()
                }
            } finally {
                inputStream?.close()
                tempFile?.delete()
            }
        } catch (e: Exception) {
            promise.reject("EXTRACTION_ERROR", "Failed to extract text: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getPageCount(uriString: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            var inputStream: InputStream? = null

            try {
                inputStream = when {
                    uriString.startsWith("content://") -> {
                        val uri = Uri.parse(uriString)
                        context.contentResolver.openInputStream(uri)
                    }
                    uriString.startsWith("file://") -> {
                        FileInputStream(File(uriString.removePrefix("file://")))
                    }
                    uriString.startsWith("/") -> {
                        FileInputStream(File(uriString))
                    }
                    else -> {
                        promise.reject("INVALID_URI", "Invalid URI format")
                        return
                    }
                }

                if (inputStream == null) {
                    promise.reject("OPEN_FAILED", "Could not open file")
                    return
                }

                val document = PDDocument.load(inputStream)
                try {
                    promise.resolve(document.numberOfPages)
                } finally {
                    document.close()
                }
            } finally {
                inputStream?.close()
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get page count: ${e.message}", e)
        }
    }
}
