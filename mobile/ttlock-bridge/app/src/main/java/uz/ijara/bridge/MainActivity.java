package uz.ijara.bridge;

import android.Manifest;
import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.content.pm.PackageManager;
import android.text.InputType;
import android.view.WindowManager;
import android.widget.*;
import com.ttlock.bl.sdk.api.TTLockClient;
import com.ttlock.bl.sdk.api.ExtendedBluetoothDevice;
import com.ttlock.bl.sdk.callback.*;
import com.ttlock.bl.sdk.constant.FeatureValue;
import com.ttlock.bl.sdk.entity.*;
import com.ttlock.bl.sdk.util.*;
import org.json.*;
import java.time.Instant;
import java.util.concurrent.*;

/** Foreground-only bridge. Closing/backgrounding clears secrets and stops further writes. */
public final class MainActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean stopped;
    private BridgeApi api;
    private JSONObject session;
    private String lockData, mac;
    private long serverTime, receivedAt, expiresAt;
    private TextView status;
    private EditText origin, login, password, property;
    private Button load, scan, connect, write;
    private boolean busy;
    private boolean awaitingSystemUi;

    @Override public void onCreate(Bundle state) {
        super.onCreate(null);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        LogUtil.setDBG(false);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 48, 32, 24);
        ScrollView scroll = new ScrollView(this); scroll.addView(layout); setContentView(scroll);
        TextView title = new TextView(this); title.setText("Ijara AI Bluetooth Sync"); title.setTextSize(24); layout.addView(title);
        origin = field(layout, "Ijara AI HTTPS manzili", false);
        login = field(layout, "Email yoki telefon", false);
        password = field(layout, "Parol", true);
        property = field(layout, "Xona propertyId", false);
        load = button(layout, "Kirish va session olish", this::loadSession);
        scan = button(layout, "Qulfni qidirish", this::scanLock);
        connect = button(layout, "Bluetooth orqali ulanish", this::connectLock);
        write = button(layout, "PINlarni qulfga yozish", this::writePins);
        scan.setEnabled(false); connect.setEnabled(false); write.setEnabled(false);
        status = new TextView(this); status.setText("Xona va hisob ma'lumotlarini kiriting. PINlar ko'rsatilmaydi."); layout.addView(status);
    }

    private EditText field(LinearLayout layout, String hint, boolean secret) {
        EditText view = new EditText(this); view.setHint(hint); view.setSingleLine(true);
        view.setSaveEnabled(false);
        view.setInputType(secret ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD : InputType.TYPE_CLASS_TEXT);
        view.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        layout.addView(view); return view;
    }
    private Button button(LinearLayout layout, String label, Runnable action) {
        Button button = new Button(this); button.setText(label); button.setOnClickListener(v -> action.run()); layout.addView(button); return button;
    }
    private void show(String message) { main.post(() -> { if (!stopped) status.setText(message); }); }
    private void disable() { load.setEnabled(false); scan.setEnabled(false); connect.setEnabled(false); write.setEnabled(false); }
    private interface Task { void run() throws Exception; }
    private void run(Task task) {
        if (busy || stopped) return;
        busy = true; disable();
        worker.execute(() -> {
            try { task.run(); }
            catch (Exception error) {
                // Exception messages from the SDK/network may contain credentials. Never display/log them.
                show(error instanceof SdkFailure ? ((SdkFailure) error).code : "Amal bajarilmadi. Sessionni yangilang; natija noma'lum bo'lsa PINni qayta yozmang.");
            } finally { main.post(() -> { busy = false; if (!stopped && session == null) load.setEnabled(true); }); }
        });
    }
    private void loadSession() {
        final String base = origin.getText().toString().trim(), who = login.getText().toString().trim();
        final String room = property.getText().toString().trim(), pass = password.getText().toString();
        password.setText("");
        run(() -> {
            api = new BridgeApi(base);
            api.bearer = api.post("/api/auth/login", new JSONObject().put("identifier", who).put("password", pass)).getString("accessToken");
            String bridge = api.post("/api/ttlock/bluetooth-sync/authorize", new JSONObject().put("propertyId", room)).getString("bridgeToken");
            session = api.post("/api/ttlock/bluetooth-sync/session", new JSONObject().put("propertyId", room));
            api.bearer = bridge;
            api.sessionToken = session.getString("sessionToken");
            expiresAt = Instant.parse(session.getString("expiresAt")).toEpochMilli();
            JSONObject context = api.post("/api/ttlock/bluetooth-sync/context", new JSONObject());
            if (!session.getString("lockId").equals(context.getString("lockId"))) throw new SdkFailure("BLUETOOTH_LOCK_IDENTITY_MISMATCH", false);
            lockData = context.getString("lockData"); mac = context.getString("lockMac");
            LockData parsed = EncryptionUtil.parseLockData(lockData);
            if (parsed == null || !LockPolicy.sameMac(mac, parsed.getLockMac())) throw new SdkFailure("BLUETOOTH_LOCK_IDENTITY_MISMATCH", false);
            serverTime = Instant.parse(context.getString("serverTime")).toEpochMilli(); receivedAt = SystemClock.elapsedRealtime();
            if (context.getInt("keyboardPwdVersion") != 4) throw new SdkFailure("BLUETOOTH_TIMED_PIN_UNSUPPORTED", false);
            show("Qulf: " + context.getString("lockName") + "\nPending: " + session.getJSONArray("entries").length() + " ta PIN");
            main.post(() -> { if (!stopped) scan.setEnabled(true); });
        });
    }
    private boolean permissions() {
        String[] permissions = Build.VERSION.SDK_INT >= 31
            ? new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}
            : new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
        for (String permission : permissions) if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
            awaitingSystemUi = true; requestPermissions(permissions, 42); return false;
        }
        return true;
    }
    private void scanLock() {
        if (!permissions()) return;
        TTLockClient sdk = TTLockClient.getDefault();
        if (!sdk.isBLEEnabled(this)) { awaitingSystemUi = true; sdk.requestBleEnable(this); return; }
        sdk.prepareBTService(getApplicationContext());
        run(() -> {
            ensureActive(); show("Qulf qidirilmoqda...");
            CompletableFuture<Boolean> found = new CompletableFuture<>();
            main.post(() -> sdk.startScanLock(new ScanLockCallback() {
                public void onScanLockSuccess(ExtendedBluetoothDevice device) {
                    if (LockPolicy.sameMac(mac, device.getAddress())) found.complete(true);
                }
                public void onFail(LockError error) { found.completeExceptionally(new SdkFailure(error)); }
            }));
            try { await(found); }
            finally { main.post(sdk::stopScanLock); }
            show("Sessiondagi qulf topildi."); main.post(() -> { if (!stopped) connect.setEnabled(true); });
        });
    }
    private void connectLock() {
        run(() -> {
            ensureActive(); TTLockClient sdk = TTLockClient.getDefault();
            CompletableFuture<Boolean> linked = new CompletableFuture<>();
            main.post(() -> sdk.connectLock(lockData, new ConnectLockCallback() {
                public void onConnectSuccess() { linked.complete(true); }
                public void onFail(LockError error) { linked.completeExceptionally(new SdkFailure(error)); }
            })); await(linked);
            try {
                CompletableFuture<Integer> features = new CompletableFuture<>();
                main.post(() -> sdk.getSpecialValue(lockData, mac, new GetSpecialValueCallback() {
                    public void onGetSpecialValueSuccess(int value) { features.complete(value); }
                    public void onFail(LockError error) { features.completeExceptionally(new SdkFailure(error)); }
                }));
                int value = await(features);
                if (!FeatureValueUtil.isSupportFeature(lockData, FeatureValue.MODIFY_PASSCODE_FUNCTION)
                    || FeatureValueUtil.isSupportFeature(lockData, FeatureValue.LOCK_NO_CLOCK_CHIP)) {
                    throw new SdkFailure("BLUETOOTH_TIMED_PIN_UNSUPPORTED", true);
                }
                CompletableFuture<DeviceInfo> info = new CompletableFuture<>();
                main.post(() -> sdk.getLockSystemInfo(lockData, mac, new GetLockSystemInfoCallback() {
                    public void onGetLockSystemInfoSuccess(DeviceInfo value) { info.complete(value); }
                    public void onFail(LockError error) { info.completeExceptionally(new SdkFailure(error)); }
                }));
                DeviceInfo deviceInfo = await(info);
                if (deviceInfo.getFirmwareRevision() == null || deviceInfo.getFirmwareRevision().isEmpty()) {
                    throw new SdkFailure("BLUETOOTH_TIMED_PIN_UNSUPPORTED", true);
                }
                CompletableFuture<Long> time = new CompletableFuture<>();
                main.post(() -> sdk.getLockTime(lockData, mac, new GetLockTimeCallback() {
                    public void onGetLockTimeSuccess(long value) { time.complete(value); }
                    public void onFail(LockError error) { time.completeExceptionally(new SdkFailure(error)); }
                }));
                long lockTime = await(time);
                if (!LockPolicy.clockMatches(lockTime, now())) throw new SdkFailure("BLUETOOTH_LOCK_CLOCK_MISMATCH", true);
            } catch (SdkFailure error) {
                failPending(error); throw error;
            }
            show("Qulf autentifikatsiyasi, capability va soat tekshirildi.");
            main.post(() -> { if (!stopped) write.setEnabled(true); });
        });
    }
    private long now() { return serverTime + SystemClock.elapsedRealtime() - receivedAt; }
    private void ensureActive() throws SdkFailure {
        if (stopped || now() >= expiresAt) throw new SdkFailure("BLUETOOTH_SESSION_EXPIRED", false);
    }
    private <T> T await(CompletableFuture<T> future) throws Exception {
        try { return future.get(30, TimeUnit.SECONDS); }
        catch (ExecutionException e) { if (e.getCause() instanceof SdkFailure) throw (SdkFailure)e.getCause(); throw e; }
        catch (TimeoutException e) { throw new SdkFailure("BLUETOOTH_RESULT_UNKNOWN", false); }
    }
    private void result(String entry, boolean success, boolean callback, String code) throws Exception {
        api.post("/api/ttlock/bluetooth-sync/result", new JSONObject().put("entryId", entry)
            .put("success", success).put("sdkCallbackReceived", callback).put("errorCode", code));
    }
    private void failPending(SdkFailure error) throws Exception {
        JSONArray entries = session.getJSONArray("entries");
        for (int i = 0; i < entries.length(); i++) result(entries.getJSONObject(i).getString("entryId"), false, error.callback, error.code);
    }
    private void writePins() {
        run(() -> {
            JSONArray entries = session.getJSONArray("entries"); int installed = 0;
            for (int i = 0; i < entries.length(); i++) {
                ensureActive();
                String entry = entries.getJSONObject(i).getString("entryId");
                JSONObject credential = api.post("/api/ttlock/bluetooth-sync/credential", new JSONObject().put("entryId", entry));
                String pin = credential.getString("credential");
                long start = Instant.parse(credential.getString("startDate")).toEpochMilli();
                long end = Instant.parse(credential.getString("endDate")).toEpochMilli();
                credential.remove("credential");
                if (!entry.equals(credential.getString("entryId")) || !LockPolicy.validWindow(start, end)) throw new SdkFailure("BLUETOOTH_INVALID_WINDOW", false);
                CompletableFuture<Boolean> written = new CompletableFuture<>();
                main.post(() -> {
                    if (stopped) { written.completeExceptionally(new SdkFailure("BLUETOOTH_CANCELLED", false)); return; }
                    TTLockClient.getDefault().createCustomPasscode(pin, start, end, lockData, mac, new CreateCustomPasscodeCallback() {
                        public void onCreateCustomPasscodeSuccess(String ignoredPin) { written.complete(true); }
                        public void onFail(LockError error) { written.completeExceptionally(new SdkFailure(error)); }
                    });
                });
                try {
                    await(written);
                } catch (SdkFailure error) {
                    result(entry, false, error.callback, error.code);
                    show((i + 1) + " / " + entries.length() + ": " + error.code);
                    if (!error.callback) throw error; // Unknown outcome: never blindly repeat a physical write.
                    continue;
                }
                // The only success reporting path follows the real createCustomPasscode callback.
                result(entry, true, true, null); installed++;
                show((i + 1) + " / " + entries.length());
            }
            show(installed + " / " + entries.length() + " ta PIN physical lockga yozildi. Qolganlari xato bilan saqlandi.");
            lockData = null; api.clear();
            main.post(() -> TTLockClient.getDefault().stopBTService());
        });
    }
    private static final class SdkFailure extends Exception {
        final String code; final boolean callback;
        SdkFailure(String code, boolean callback) { this.code = code; this.callback = callback; }
        SdkFailure(LockError error) {
            this(error == LockError.LOCK_IS_NOT_SUPPORT || error == LockError.INVALID_COMMAND
                ? "BLUETOOTH_TIMED_PIN_UNSUPPORTED" : "TTLOCK_" + error.name().toUpperCase(java.util.Locale.ROOT), true);
        }
    }
    @Override protected void onStop() {
        super.onStop();
        // Permissions/Bluetooth enable dialogs can pause the activity before an operation starts.
        if (!awaitingSystemUi) {
            stopped = true; lockData = null;
            if (api != null) api.clear();
            TTLockClient.getDefault().stopBTService(); finish();
        }
    }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        awaitingSystemUi = false;
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        awaitingSystemUi = false;
    }
    @Override protected void onDestroy() {
        stopped = true; lockData = null; session = null;
        if (api != null) api.clear(); worker.shutdownNow();
        TTLockClient.getDefault().stopBTService(); super.onDestroy();
    }
}
