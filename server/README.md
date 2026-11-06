# Kipp stack — backend (`/server`)

Node/TS API for the KIPP mobile app. Part of the **Kipp stack**: one box
(`ZINGO-PC` / `cpu.blackvisiontech.com`) running Coolify, which orchestrates
Postgres, Neo4j and this service behind a public HTTPS URL.

## Data ownership

| Store | Holds | Why |
|---|---|---|
| **PostgreSQL** | users, devices, tasks, conversations, messages, memories | conventional rows: auth, sync state, offline outbox replay, transactions |
| **Neo4j** | `Person` / `Task` / `Memory` / `Project` nodes + edges (`OWNS`, `REMEMBERS`, `MENTIONS`, `RELATES_TO`) | the person graph — everything *about* someone and how it connects |

Postgres is the source of record (same `uuid` in both stores); Neo4j is written
write-through on mutation (`src/graph/sync.ts`) and is query-only for the app.
Graph schema is created idempotently by `npm run graph:bootstrap`.

## Run

```bash
cd server
npm install
cp .env.example .env      # fill DATABASE_URL / NEO4J_* / JWT_SECRET / GOOGLE_CLIENT_IDS
npm run db:generate       # writes SQL migrations from src/db/schema.ts
npm run db:migrate
npm run graph:bootstrap
npm run dev               # http://localhost:3001
```

Health: `GET /healthz` → 200 when both Postgres and Neo4j answer, 503 otherwise.

## Auth

`POST /v1/auth/google { idToken }` — verifies the Google ID token the app gets
from `expo-auth-session` / `@react-native-google-signin`, upserts the user, and
returns `{ token, user }`. The JWT (`HS256`, `sub` = user id) is what the app
sends as `Authorization: Bearer …`. `GET /v1/me` is the profile check.

## Deploy (Coolify)

- Image builds from `server/Dockerfile`, listens on **3001**.
- The repo is **private** → Coolify needs the GitHub App source (Add GitHub App),
  not a plain git URL.
- Env comes from Coolify's env editor; `DATABASE_URL` / `NEO4J_*` should use the
  Coolify resource hostnames (internal network), never `localhost`.

## Contracts

`src/contracts.ts` mirrors the app's `src/lib/schemas.ts` (task, memory,
kippTurn) so client and server agree on shapes. Keep them in sync until they
move into a shared package.
