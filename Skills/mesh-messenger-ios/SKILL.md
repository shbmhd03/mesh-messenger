---
name: "mesh-messenger-ios"
description: "Use when building or debugging the iOS (Swift) client of the mesh messenger: CoreBluetooth dual-role transport, background BLE limits and state restoration, MultipeerConnectivity, APNs relay path with NSE decryption, GRDB+SQLCipher, SwiftUI chat UI."
---

# Mesh Messenger — iOS (Swift)

Native iOS client for the mesh messenger. Implements the protocol from the `mesh-messenger-core` skill — read that first. This skill covers iOS-specific transports, the harsh background reality, and app concerns.

## Project setup

- Swift 5.9+, SwiftUI, MVVM, async/await + AsyncStream for transport events. iOS 16+ target.
- Packages: `MeshCore` (pure Swift protocol/crypto — no UIKit/CoreBluetooth imports, testable on macOS), `TransportBLE`, `TransportMultipeer`, `TransportRelay`, `DataStore`, app target.
- Crypto: `LibSignalClient` (Swift package) preferred; otherwise CryptoKit (Curve25519, ChaChaPoly, HKDF) implementing the core skill's scheme. CryptoKit covers everything double-ratchet needs.

## Info.plist / capabilities

- `NSBluetoothAlwaysUsageDescription` (write a real explanation — App Review reads it).
- Background Modes: `bluetooth-central`, `bluetooth-peripheral`, plus `remote-notification` for the relay path.
- `NSLocalNetworkUsageDescription` + Bonjour service types if using MultipeerConnectivity/local sockets.

## CoreBluetooth transport (primary offline transport)

Dual role, same as Android: run `CBCentralManager` and `CBPeripheralManager` together.

**Peripheral (advertising + GATT server):**
- One service UUID for the app; characteristics: `TX` (writeWithoutResponse from centrals), `RX` (notify), `HANDSHAKE`.
- Foreground: advertise service UUID normally. **Background: iOS moves your service UUID out of the main advertisement into a special "overflow area"** — only visible to iPhones scanning explicitly for that UUID, invisible to Android scanners. Consequence: two backgrounded iPhones can still find each other; an Android phone cannot see a backgrounded iPhone. Mitigate by having Android connect while iOS is foregrounded and by relay bridging.
- Local name is dropped in background; don't rely on it for identity — do identity in the HANDSHAKE characteristic exchange.

**Central (scanning + connecting):**
- Always scan with the service UUID filter (mandatory in background anyway). `CBCentralManagerScanOptionAllowDuplicatesKey` is ignored in background — you get one discovery per peripheral, so connect promptly.
- Use **state restoration**: init managers with `CBCentralManagerOptionRestoreIdentifierKey` / peripheral equivalent, implement `willRestoreState`. iOS will relaunch the app for pending BLE events even after termination — this is your lifeline for background mesh.
- `connect()` has **no timeout on iOS** and pending connects survive app suspension — issue connects to known peers and let iOS complete them opportunistically ("pending connection" pattern).
- Write chunk size: use `maximumWriteValueLength(for: .withoutResponse)` per connection; respect `peripheralIsReady(toSendWriteWithoutResponse:)` for flow control. Notifications from the server side: honor `updateValue` returning false and resend on `peripheralManagerIsReady(toUpdateSubscribers:)`.
- Role collision: same rule as core/Android — lower NodeID stays central.

## MultipeerConnectivity (high-bandwidth path)

- Use MPC (`MCNearbyServiceAdvertiser`/`Browser` + `MCSession`) for peer-to-peer Wi-Fi / AWDL speeds between Apple devices — ideal for attachments and fast sync when both apps are foregrounded.
- MPC is **foreground-only** (suspends with the app) and Apple-to-Apple only. Treat it as an opportunistic upgrade negotiated over BLE, mirroring the Android Wi-Fi Direct approach: exchange an invite token over BLE, bring up MPC, transfer, tear down.
- Cap MPC sessions at ~7 peers; use `.required` encryption (it's TLS-ish, but still send only mesh ciphertext through it).
- For cross-platform Wi-Fi: optional TCP/`Network.framework` (`NWListener` with Bonjour) — works with Android over the same LAN.

## Background execution — design around the constraints

iOS will not let you run a persistent mesh daemon. The honest model:

- **Foreground**: full mesh (scan + advertise + MPC + relay socket).
- **Background**: BLE keeps working via background modes — existing GATT connections stay alive, pending connects fire, filtered scans continue slowly, overflow-area advertising as above. Events wake you for ~10s bursts: process packets, persist, schedule, return.
- **Terminated**: state restoration revives you for BLE connect/data events on known peripherals. Test this hard (it's fiddly but it works).
- **BGProcessingTask / BGAppRefreshTask**: schedule queue-flush and relay-sync tasks; expect minutes-level granularity at best.
- **Relay path**: APNs. Run the relay socket only in foreground; for background delivery, the relay sends a push. Use **Notification Service Extension** to decrypt the pushed ciphertext (share session state with the extension via App Group + Keychain access group, with careful locking — single-writer rule: extension marks "dirty", app reconciles). This is exactly how Signal/WhatsApp do E2EE pushes.
- Persist EVERYTHING on every `didEnterBackground` and after every processed packet — assume you can be killed at any instant.

Set user expectations in-product: offline mesh delivery on iOS is best-effort while backgrounded; a small "keep open for mesh relay mode" screen (prevent idle sleep with `isIdleTimerDisabled` when the user opts in) is a legitimate advanced feature for events/emergency use-cases.

## Data layer

- SQLite via GRDB + SQLCipher, DB key in Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — background BLE events must be able to decrypt after reboot-unlock).
- Identity key: Curve25519 keys stored in Keychain; Secure Enclave can't do X25519 ratchets, so software keys in Keychain is the standard approach. Optional biometric app-lock wrapping a secondary key.
- App Group container for DB if the notification extension needs read/write.

## UI essentials (SwiftUI)

- Conversation list, chat view with delivery states, mesh status screen (neighbor list, RSSI, transport badges, hop counts), QR safety-number verification, permission onboarding explaining Bluetooth usage.
- UserNotifications with communication notifications (`INSendMessageIntent`) for proper sender avatars/threading.

## App Review notes

- Justify background Bluetooth clearly in the review notes; a demo video of two devices messaging offline helps.
- Frame App Store copy as "offline communication for events, travel, emergencies" — this reviews well.

## Testing

- `MeshCore` unit tests against shared golden vectors (see core skill) — must match Android/web outputs byte-for-byte.
- BLE requires physical devices. Minimum rig: 2 iPhones + 1 Android for cross-platform interop. Automate with XCUITest driving airplane-mode scenarios manually documented.
- Test matrix that catches 90% of bugs: app foreground↔background × peer foreground↔background × app terminated-with-restoration; Bluetooth toggle mid-transfer; iOS↔Android interop with iOS backgrounded (expect discovery failure — verify graceful degradation).

## Pitfalls checklist

- Overflow-area advertising (Android can't see backgrounded iOS). State restoration keys on both managers. No connect timeout — implement your own for UX only, keep the pending connect. Respect write flow control both directions. Keychain accessibility set for background decrypt. Persist on every packet. MPC is foreground-only — never rely on it for delivery guarantees.
