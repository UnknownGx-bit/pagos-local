package com.pagolocal.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) {
                    moveTaskToBack(true);
                    return;
                }
                // React handles dialogs first, then its hash-router history.
                bridge.getWebView().evaluateJavascript(
                    "!window.dispatchEvent(new Event('pagos-native-back', {cancelable:true}))",
                    handled -> {
                        if (!"true".equals(handled)) moveTaskToBack(true);
                    }
                );
            }
        });
    }
}
