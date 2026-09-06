package com.pagolocal.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import android.webkit.WebView;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Remove legacy PWA controllers even when an older cached UI is loaded.
        // This does not touch IndexedDB, where the user's records live.
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                webView.evaluateJavascript(
                    "(async()=>{if(!('serviceWorker' in navigator))return;" +
                    "const registrations=await navigator.serviceWorker.getRegistrations();" +
                    "if(!registrations.length)return;" +
                    "await Promise.all(registrations.map(r=>r.unregister()));" +
                    "location.reload();})().catch(()=>{})", null);
            }
        });
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) {
                    return;
                }
                // Never interpret a missing/late React listener as permission to exit.
                bridge.getWebView().evaluateJavascript(
                    "(()=>{" +
                    "if(!window.dispatchEvent(new Event('pagos-native-back',{cancelable:true})))return 'handled';" +
                    "const dialogs=document.querySelectorAll('[role=dialog]');" +
                    "if(dialogs.length){const close=dialogs[dialogs.length-1].querySelector('[aria-label=\"Cerrar\"]');if(close)close.click();return 'handled';}" +
                    "const route=location.hash.replace(/^#/, '').split('?')[0];" +
                    "if(route&&route!=='/'){if(Number(history.state?.idx)>0)history.back();else location.hash='/';return 'handled';}" +
                    "return document.querySelector('main')?'home':'loading';" +
                    "})()",
                    handled -> {
                        if ("\"home\"".equals(handled)) moveTaskToBack(true);
                    }
                );
            }
        });
    }
}
