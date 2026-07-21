# Mercury

A lightweight Mailchimp-style email marketing tool — manage contacts, build audiences, and send tracked email campaigns, either right away or scheduled through a real background queue. Built as a take-home assignment / learning project, from scratch, feature by feature.

**Live app:** https://frontend-production-c7b3.up.railway.app
**API:** https://backend-production-6171.up.railway.app
**Repo:** https://github.com/vaishnaviwakodikar/olio-marketing-app.git
**Demo video:** https://www.loom.com/share/fe0549344d9047939736ae0bd2524873
Note : DNS to be set to IPv4 8.8.8.8 & 8.8.4.4
---

## Tech stack

| Layer         | Choice                                      |
|---------------|----------------------------------------------|
| Frontend      | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend       | Node.js, Express (TypeScript), separate from the frontend — not using Next's API routes |
| Database      | PostgreSQL via Prisma ORM, hosted on Neon   |
| Queue / jobs  | Redis + BullMQ (hosted on Upstash), with a dedicated worker process |
| Email         | Mailgun (sandbox domain), with webhooks for delivery/open tracking |
| Hosting       | Railway (backend, frontend, and worker as three separate services) |
| Monorepo      | `apps/backend` and `apps/frontend`, npm workspaces |

## Monorepo structure

```
.
├── apps/
│   ├── backend/                    # Express API + BullMQ worker
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── lib/
│   │   │   │   ├── mailProvider.ts # Mailgun client
│   │   │   │   └── prisma.ts       # Prisma client
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts         # JWT verification, workspace resolution
│   │   │   ├── queue/
│   │   │   │   ├── campaignQueue.ts
│   │   │   │   ├── connection.ts
│   │   │   │   └── worker.ts
│   │   │   └── routes/
│   │   │       ├── audiences.ts
│   │   │       ├── auth.ts
│   │   │       ├── campaigns.ts
│   │   │       ├── contacts.ts
│   │   │       └── webhooks.ts
│   │   ├── .env / .env.example
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/                   # Next.js dashboard
│       ├── app/
│       │   ├── layout.tsx, page.tsx, globals.css
│       │   ├── login/page.tsx
│       │   ├── signup/page.tsx
│       │   └── dashboard/
│       │       ├── layout.tsx, page.tsx
│       │       ├── audiences/page.tsx
│       │       ├── contacts/page.tsx
│       │       ├── profile/page.tsx
│       │       └── campaigns/
│       │           ├── page.tsx
│       │           └── [id]/page.tsx
│       ├── components/
│       │   └── AuthLayout.tsx
│       ├── lib/
│       │   └── api.ts              # typed fetch wrapper
│       ├── public/
│       ├── .env.local
│       ├── next.config.ts
│       └── package.json
├── mock-data/
│   └── contacts.csv                # sample data for testing CSV import
├── package.json                    # workspaces root
└── README.md
```

`apps/backend` and `apps/frontend` are independent deployable services that share tooling but not code directly.

## Core concepts

**Auth & workspaces.** Signup/login issues a JWT; every user belongs to a `Workspace`, and every workspace-scoped query (contacts, audiences, campaigns) filters by `workspaceId` server-side. Data isolation was verified manually with two independent test accounts.

**Contacts** are the base unit — name, email, phone, and arbitrary `customFields` (JSON). Supports:
- Manual CRUD
- **CSV import**, with duplicate detection by email or phone (scoped per workspace) — the import reports counts back afterward (e.g. "16 added, 2 skipped as duplicates")
- Duplicate emails/phones are blocked per-workspace at the manual-entry level too (nulls are allowed to repeat, since not every contact has both)

**Audiences** are saved filters over contacts (multiple AND'd field conditions, e.g. "has tag: vip"), resolved fresh every time they're viewed or used to send — not a static snapshot — so an audience always reflects current contacts, with a live member count.

**Campaigns** are the centerpiece:
- Composed with a name, subject line, body, and an optional PDF attachment (stored as bytes in Postgres, so it's available whenever the send job actually runs — even days later for a scheduled send).
- Recipients come from either a saved **audience** or a **pasted list** of raw emails/phones (matched against saved contacts; unmatched entries are flagged, not silently dropped).
- Can **send immediately** or be **scheduled** for a future date/time — scheduling is a real, computed-delay BullMQ job stored in Redis, and **survives the API server restarting** (only the worker process needs to be running when the send time arrives).
- Draft campaigns can be **duplicated** — this creates a safe copy that always starts as a fresh `DRAFT` (content copied, recipients re-resolved), so a duplicate is never accidentally sent on its own.
- A `DRAFT` campaign (including a freshly duplicated one) can be **edited and sent** directly from its detail page: an "Edit & send" button opens a pre-filled form (name, subject, body, recipients, attachment, send timing), and submitting it re-resolves recipients from scratch and enqueues the actual send — this is what turns a duplicate into a real, sendable campaign.
- The campaign detail page always shows the **message content** (name, subject, body, and a link to view the attachment if one was added) regardless of status, so you can see exactly what was — or will be — sent, not just its analytics.
- Once sent, a live analytics view shows recipient-by-recipient status (pending → sent → delivered → opened, or failed/unmatched), polling every 5 seconds, fed by Mailgun webhooks.
- There's currently no delete option in the UI for campaigns, audiences, or contacts — cleanup during development is a manual DB operation via Prisma Studio or direct SQL (`CampaignRecipient` rows must be deleted before the parent `Campaign` row, since the foreign key is `RESTRICT`, not cascading).



## Running locally

### 1. Prerequisites
- Node 18+
- A Postgres database (e.g. a free [Neon](https://neon.tech) project)
- A Redis instance (e.g. a free [Upstash](https://upstash.com) database)
- A [Mailgun](https://mailgun.com) account with a sandbox domain and at least one verified recipient email

### 2. Backend

```bash
cd apps/backend
npm install
cp .env.example .env   # fill in the values above
npx prisma migrate dev
npm run dev             # API server on :4000
```

In a **second terminal**, start the queue worker (a separate long-running process from the API server):

```bash
cd apps/backend
npm run worker
```

### 3. Frontend

```bash
cd apps/frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev              # app on :3000
```

Requires a reachable Postgres and Redis instance — either local (if Docker/native installs are available) or hosted (Neon + Upstash), pointed to via the env vars above.

## Deployment

Deployed on Railway as three services from the same repo:
1. **backend** — the Express API
2. **worker** — the BullMQ worker process (same codebase, different start command) that actually sends scheduled/queued emails
3. **frontend** — the Next.js app

Postgres is Neon, Redis is Upstash — both provisioned outside Railway and wired in via environment variables, since Railway's own Postgres/Redis add-ons weren't used for this project.

## Design

UI theme is "Mercury" — navy (`#0F2044`) and gold (`#C9A227`) on a cream background (`#FBF8F2`), Newsreader serif for headings/logo, Inter for body text.

## Decisions & tradeoffs

- **CSV duplicate handling: skip, not merge.** Skipping is simpler to reason about and test; a merge strategy is arguably more "correct" for a real product but adds ambiguity around which field wins when two rows disagree. The same dedup check (by email/phone within a workspace) also applies to manually-added contacts.
- **Audiences are live queries, not snapshots.** A saved audience re-evaluates its filter every time it's viewed or used to send, rather than freezing membership at creation time. This matches how most email tools ("segments") behave, and is simpler to implement correctly than a snapshot model.
- **Tags from the CSV import aren't real relational tags yet.** The sample CSV's `tags` column is stored as a plain custom field (`customFields.tags`) rather than being split into proper `Tag`/`ContactTag` rows. Audiences can filter on it as a text field (e.g. `tags = vip`), but there's no autocomplete or many-to-many tag browsing. Given more time, this would be the first thing to properly relational-ize.
- **Global async error handling.** Express 4 doesn't automatically catch rejected promises inside async route handlers — an early version of this app crashed entirely on a transient database hiccup (Neon's free tier cold-starts after inactivity). Fixed with `express-async-errors` plus a final error-handling middleware, so a single failing request now returns a 500 instead of taking the whole server down.
- **Open-tracking false positives on Gmail.** Gmail prefetches images (including the tracking pixel) server-side as soon as an email is delivered, before a person actually opens it — so some recipients show as "Opened" within seconds of "Delivered" even without a real open. This is a known, industry-wide limitation of pixel-based tracking, not specific to this implementation.
- **Webhook signature verification is logged, not enforced.** If Mailgun's HMAC signature doesn't verify, the webhook still returns 200 (so Mailgun doesn't endlessly retry) but logs a warning rather than rejecting the request. In a production system handling real money/PII this should hard-reject with a 401 instead.
- **PDF attachments are served inline, not from object storage.** A dedicated `GET /api/campaigns/:id/attachment` route streams the file straight from the `Bytes` column in Postgres, so it opens in a new browser tab rather than forcing a download. Fine at this scale; a real product would move this to S3/R2 rather than keeping binary blobs in the primary database.

## What's not done / would do next with more time

- Real relational tags (see above) instead of a flattened custom field
- Stronger webhook signature enforcement (401 on failure rather than log-and-accept)
- Attachment size/type validation is minimal (PDF mime-type check only, 10MB cap) — no virus scanning or content validation

