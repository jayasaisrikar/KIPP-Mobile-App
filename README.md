# KIPP Companion App

Expo + React Native + TypeScript mobile app implementing the KIPP PRD (v1.0).

## Stack
Expo Router, TanStack Query, Zustand, Zod, expo-sqlite, expo-secure-store, expo-notifications, expo-audio.

## Run
```bash
npm install
npx expo start
```

## Structure
- `app/` — Expo Router routes (tabs: Home, Talk, Plans, You; onboarding; modals)
- `src/components` — UI primitives + KIPP animated face
- `src/stores` — Zustand app state
- `src/db` — SQLite offline cache/outbox
- `src/lib` — Zod schemas, contracts
- `src/types` — shared types
- `src/constants` — design tokens

## Notes
- Phase 0/1 vertical slice: onboarding, Home, Talk (mocked structured turns + action cards), Plans, You (memories, connected apps demo, devices, settings).
- Voice capture (expo-audio), Google OAuth, notifications wiring are scaffolded behind interfaces; production integrations land per PRD phases.
