---
name: "mesh-messenger-android"
description: "Use when building or debugging the Android (Kotlin) client of the mesh messenger: BLE GATT transport, Wi-Fi Aware/Direct, Nearby Connections, foreground services, Doze/battery survival, Room+SQLCipher storage, and Compose chat UI."
---

# Mesh Messenger — Android (Kotlin)

Native Android client for the mesh messenger. Implements the protocol defined in the `mesh-messenger-core` skill — read that first; this skill covers only Android-specific transport, background execution, and app concerns.

## Project setup

- Kotlin + Jetpack Compose (Material 3), single-activity architecture, `minSdk 26`, `targetSdk` latest.
- Modules: `:core` (pure Kotlin protocol/crypto lib — no Android imports, unit-testable on JVM), `:transport-ble`, `:transport-wifi`, `:transport-relay`, `:data` (Room + SQLCipher), `:app` (Compose UI).
- Coroutines + Flow throughout; each transport exposes `Flow<PeerEvent>` and `suspend fun send(...)`.
- Crypto: `libsignal-client` Android artifact; fall back to Tink/libsodium (lazysodium) for primitives if hand-rolling per core skill.

## Permissions (declare and runtime-request correctly)

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<!-- API ≤ 30 legacy -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30"/>
<!-- Wi-Fi Direct / Aware -->
<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" android:usesPermissionFlags="neverForLocation"/>
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

`neverForLocation` on API 31+ avoids the location requirement — but then the OS strips iBeacon-style location results; that's fine for our GATT use. On API ≤ 30 you still need fine location granted for BLE scans. Build a proper permission onboarding flow explaining why.

## BLE transport (primary offline transport)

Every node is BOTH GATT peripheral (advertiser) and central (scanner) simultaneously — Android supports this and it's what makes true mesh possible.

**Advertising (peripheral role):**
- Advertise a fixed 128-bit service UUID for the app. Put a truncated NodeID (8 bytes) in service data so peers can pre-filter before connecting.
- Use `AdvertiseSettings.ADVERTISE_MODE_BALANCED` normally; `LOW_POWER` in battery saver.
- GATT server exposes one service with characteristics: `TX` (peer writes inbound frames, `WRITE_NO_RESPONSE` for throughput), `RX` (notify outbound frames), `HANDSHAKE` (hello/identity exchange).

**Scanning (central role):**
- Always scan with a `ScanFilter` on the service UUID — unfiltered scans are throttled hard and killed in background.
- Duty-cycle: 8s scan / 22s idle in foreground service mode; adapt with battery level. Android silently downgrades scans if you scan continuously (>30 min → opportunistic).
- Beware the 5-scans-per-30s app throttle: never start/stop scans in tight loops.

**Connections:**
- After connect: `requestMtu(517)` first, then negotiate; compute usable payload = MTU − 3. Request `CONNECTION_PRIORITY_HIGH` during bulk transfer, drop to `BALANCED` after.
- Cap concurrent GATT connections (~4–7 practical; hard system cap around 32 but real radios choke earlier). Prefer connecting to nodes advertising high battery/relay class.
- **Serialize all GATT operations** — Android's BluetoothGatt is not reentrant; queue every read/write/notify and only issue the next op after the previous callback. Most BLE bugs on Android come from violating this.
- Handle status 133 (GATT_ERROR) with close + delayed retry; always `close()`, not just `disconnect()`.
- Deduplicate role collisions: if both sides connect to each other, keep the link where the lexicographically smaller NodeID is central; drop the other.

## Wi-Fi transports (high-bandwidth path)

- **Wi-Fi Aware (NAN)** — preferred on supported devices (`PackageManager.FEATURE_WIFI_AWARE`): publish/subscribe on a service name, then request a network for a socket. No group-owner mess, works alongside normal Wi-Fi.
- **Wi-Fi Direct fallback**: use for large attachments only. Group-owner negotiation is flaky; treat it as an opportunistic upgrade triggered when a file transfer exceeds ~64KB, negotiated over the existing BLE link (exchange IP/port via BLE, then open a TCP socket).
- Alternative pragmatic option: **Google Nearby Connections API** (`P2P_CLUSTER` strategy) wraps BLE + Wi-Fi hotspot with automatic upgrades — good for shipping fast, but it's opaque and Google-Play-Services-bound; keep it behind the transport interface so you can swap it out.

## Internet relay transport

- OkHttp WebSocket to relay server(s); reconnect with jittered exponential backoff; respect Doze (see below).
- Ship ciphertext mesh packets verbatim over the socket. Advertise RELAY capability in HELLO beacons when the socket is healthy.

## Background execution (this determines whether the mesh actually works)

- Run the mesh in a **foreground service** with `foregroundServiceType="connectedDevice"` and a persistent low-priority notification showing peer count / queue depth.
- Request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` exemption via settings intent (messaging apps qualify), but never depend on it.
- Doze: BLE GATT connections survive Doze, but network sockets die and scans stop in deep Doze. Use `WorkManager` periodic work (15 min minimum) as a safety net to nudge queues; use `setForegroundAsync` for long syncs.
- Handle process death: persist outbox/session state on every transition (Room, WAL mode); the service must be able to cold-restore the entire mesh state.
- OEM killers (Xiaomi, Samsung, OnePlus…): detect and show guidance (dontkillmyapp.com patterns) for whitelisting.

## Data layer

- Room + SQLCipher; passphrase wrapped by Android Keystore AES key (`setUserAuthenticationRequired(false)` for background decrypt; offer an optional app-lock with biometric that wraps a second key).
- Identity/signing keys: generate in Android Keystore where possible; ratchet states must live in SQLCipher (Keystore can't do X25519 ratchets), which is standard practice.
- `messages` table indexed on (convo_id, timestamp); paging with Paging 3 into Compose `LazyColumn`.

## UI essentials (Compose)

- Conversation list, chat screen with delivery states (pending → sent → delivered → read), mesh status screen (live neighbor graph, hop counts, transports per peer — great for debugging and a differentiator feature), QR safety-number verification screen, onboarding permission flow.
- Show per-message transport badge (BLE / Wi-Fi / relay) in a debug view.
- MessagingStyle notifications with direct reply; bubble support optional.

## Testing

- `:core` protocol tests on JVM against the shared golden vectors (see core skill).
- Robolectric for service lifecycle; instrumented multi-device BLE tests on a small physical device farm (emulators can't do BLE) — script two phones + adb into a loopback delivery test.
- Chaos test: airplane-mode toggling, Bluetooth restarts, Doze simulation via `adb shell dumpsys deviceidle force-idle`.

## Pitfalls checklist

- Don't scan without filters. Don't run GATT ops in parallel. Always close() GATT. MTU-3 payload math. Status 133 retry. Role-collision dedup. Persist before process death. Request notifications permission on API 33+. Test on at least one aggressive-OEM device.
