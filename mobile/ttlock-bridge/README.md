# TTLock Bluetooth Bridge

This is the native Android Bluetooth bridge for the Ijara AI timed-PIN flow. It uses the official TTLock Android SDK `com.ttlock:ttlock:3.5.7` and never reports installation without the SDK success callback.

## Production flow

The bridge:

1. Authenticates the user and requests a short-lived bridge token.
2. Creates a Bluetooth sync session.
3. Obtains one-time lock context and verifies the cached lock MAC.
4. Scans and matches the physical lock MAC before connecting.
5. Verifies `FeatureValue.MODIFY_PASSCODE_FUNCTION` and the lock clock.
6. Retrieves each PIN once from the no-store credential endpoint.
7. Calls `TTLockClient.createCustomPasscode(passcode, startDate, endDate, lockData, lockMac, callback)`.
8. Posts one result to `/api/ttlock/bluetooth-sync/result` only after the SDK callback.

PIN values are never logged, displayed, persisted, or cached by the bridge. Unknown SDK outcomes are not retried automatically.

## SDK

The dependency is the official artifact documented by the TTLock Android demo:

```gradle
implementation 'com.ttlock:ttlock:3.5.7'
```

The exact API was verified against the 3.5.7 source artifact and demo: `prepareBTService`, `startScanLock`, `connectLock`, `getSpecialValue`, `getLockSystemInfo`, `getLockTime`, and `createCustomPasscode`.

## Build

Install Android Studio and configure `ANDROID_HOME` or `mobile/ttlock-bridge/local.properties` with `sdk.dir`. Then run:

```powershell
.\gradlew.bat assembleDebug
```

There is no mock implementation. A physical D10 and Android Bluetooth hardware are required for end-to-end verification.
