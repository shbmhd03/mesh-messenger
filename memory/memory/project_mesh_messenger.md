---
name: mesh-messenger
description: "User is building an advanced mesh messenger (Android native Kotlin, iOS native Swift, web app) — 4 skills saved covering protocol/E2EE, Android, iOS, web"
metadata: 
  node_type: memory
  type: project
  originSessionId: ce89bc01-1248-47ee-ac3d-85653cf22fac
---

User is developing an advanced (not basic) mesh messenger app across Android, iOS, and web.

Decisions made 2026-07-09: native stacks (Kotlin + Jetpack Compose, Swift + SwiftUI), hybrid transports (BLE + Wi-Fi Direct/Aware/MPC + internet relay bridging), full Signal-style E2EE (X3DH, double ratchet, sender keys for groups).

**Why:** native chosen because advanced radio features (BLE dual-role, Wi-Fi Aware) require native APIs anyway.

**How to apply:** Four saved skills exist and are the source of truth: `mesh-messenger-core` (wire protocol, routing, E2EE — authoritative on protocol conflicts), `mesh-messenger-android`, `mesh-messenger-ios`, `mesh-messenger-webapp`. Load the relevant one(s) when the user works on this app; keep implementations interoperable via the shared golden test vectors described in the core skill.
