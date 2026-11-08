package com.hellobrothers.desk;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    static final String APP_URL = "https://shreesawriyasolutions.github.io/hellobrothers-smartstore/desk.html";
    static final String APP_HOST = "shreesawriyasolutions.github.io";
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFF000000);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " HBDeskApp/1");
        CookieManager.getInstance().setAcceptCookie(true);

        web.addJavascriptInterface(new Bridge(), "HBAndroid");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if ((scheme.equals("https") || scheme.equals("http")) && APP_HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
                catch (Exception e) { Toast.makeText(MainActivity.this, "Ye link nahi khul paaya", Toast.LENGTH_SHORT).show(); }
                return true;
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showOffline();
            }
        });

        if (state != null) web.restoreState(state); else web.loadUrl(APP_URL);
    }

    private void showOffline() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
            + "<body style='margin:0;background:#000;color:#f5f5f7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
            + "<div style='padding:24px'><h2 style='margin:0 0 8px'>Internet nahi hai</h2>"
            + "<p style='color:#a1a1a6;margin:0 0 20px'>Connection check karke dobara try kariye.</p>"
            + "<button onclick='HBAndroid.retry()' style='background:#FFC400;color:#000;border:0;border-radius:999px;padding:12px 28px;font-size:16px;font-weight:700'>Dobara try karo</button></div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){var s=document.getElementById('sheet');if(s&&!s.hidden){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return 'closed';}return 'no';})()",
            v -> {
                if (v != null && v.contains("closed")) return;
                if (web.canGoBack()) web.goBack(); else finish();
            });
    }

    class Bridge {
        @JavascriptInterface
        public void retry() { runOnUiThread(() -> web.loadUrl(APP_URL)); }

        @JavascriptInterface
        public void saveFile(String name, String base64, String mime) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
                if (mime == null || mime.isEmpty()) mime = "application/octet-stream";
                boolean saved = false;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/HelloBrothers");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(bytes); }
                        saved = true;
                    }
                }
                File dir = new File(getCacheDir(), "shared");
                dir.mkdirs();
                File f = new File(dir, safe);
                try (FileOutputStream fos = new FileOutputStream(f)) { fos.write(bytes); }
                Uri share = FileProvider.getUriForFile(MainActivity.this, "com.hellobrothers.desk.files", f);
                final boolean wasSaved = saved;
                final String m = mime;
                runOnUiThread(() -> {
                    if (wasSaved) Toast.makeText(MainActivity.this, "Downloads/HelloBrothers me save ho gaya", Toast.LENGTH_SHORT).show();
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(m);
                    send.putExtra(Intent.EXTRA_STREAM, share);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, "Bhejo / kholo"));
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "File save nahi hui", Toast.LENGTH_SHORT).show());
            }
        }
    }
}
