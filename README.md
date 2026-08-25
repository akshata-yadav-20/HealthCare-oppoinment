# CuraVia Health — AI-Powered Healthcare Appointment Platform (Portfolio-Grade)

> **Live Deployment:** Frontend https://health-care-oppoinment.vercel.app/ | Backend https://health-care-oppoinment-7qu4aa.vercel.app/ — Vercel akshata10 (auto-deploy from main)


Sage-trusted care, clay-warm follow-ups. Hold-protected bookings (10m TTL), AI triage, medication timelines — built for evaluation.

## Overview

CuraVia demonstrates production-grade scheduling:
- Double-booking prevention via DB unique constraint + transaction
- Hold + expiry (10 min) with cron every minute
- Leave conflict handling (cancels HELD/CONFIRMED, enqueues LEAVE_CANCELLATION)
- Notification retry queue (3x exponential backoff 1s/2s/4s, dead-letter, best-effort calendar)
- LLM exact prompts + fallback (stub mode, timeout 10s, never blocks booking)
- Distinct design system sage #2D6A4F / clay #E07A5F / cream #FEFAE0 / charcoal #264653, Fraunces + Plus Jakarta Sans (not teal/indigo)

## Tech Stack

- **Backend:** Express 4.19 + TypeScript 5.4, Prisma 5.14 (Postgres, mock fallback), Zod, Pino, Nodemailer, googleapis, node-cron, bcryptjs, jsonwebtoken
- **Frontend:** Vite 5.4 + React 18, React Router 6, Axios, Framer Motion 11, lucide-react, Recharts 3, Tailwind tokens (sage/clay)
- **Infra:** docker-compose (postgres:15, redis:7), vercel.json (static-build), mock DB mode (USE_MOCK_DB=true, no DB required)

## Setup

```bash
git clone <repo> && cd curavia-health
# Backend
cd backend && npm install
cp ../.env.example .env  # edit JWT_SECRET etc
npm run dev  # tsx watch src/server.ts -> http://localhost:4001, health /health
# Frontend (new terminal)
cd ../frontend && npm install
# .env already has VITE_API_URL=http://localhost:4001
npm run dev  # vite --port 5174 -> http://localhost:5174
# Optional: docker-compose up -d (postgres/redis) then set USE_MOCK_DB=false and DATABASE_URL
```

Seed runs automatically on server start via seed.ts (mock store or Prisma). Manual: `npm run seed` in backend.

## Environment Variables

**Backend `.env` (see .env.example):**

| Var | Default | Purpose |
|-----|---------|---------|
| PORT | 4001 | Server port |
| DATABASE_URL | postgresql://user:password@localhost:5432/curavia | Prisma; if contains user:password or empty -> mock mode |
| JWT_SECRET | curavia-dev-jwt-secret-32chars-change-in-prod!! | JWT signing |
| JWT_EXPIRES_IN | 7d | Token TTL |
| LLM_PROVIDER | stub | stub or openai |
| LLM_API_KEY |  | OpenAI key; empty -> stub |
| LLM_MODEL | gpt-4o-mini | Model |
| LLM_TIMEOUT_MS | 10000 | 10s timeout |
| LLM_BASE_URL | https://api.openai.com/v1 | API base |
| SMTP_HOST/PORT/USER/PASS/FROM/SECURE | smtp.ethereal.email:587 | Nodemailer; empty HOST -> jsonTransport stub |
| GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI/ENCRYPTION_KEY |  | Calendar OAuth; empty -> stub |
| FRONTEND_URL | http://localhost:5174 | CORS |
| USE_MOCK_DB | true | Force mock store (no DB) |

**Frontend `.env`:**

```
VITE_API_URL=http://localhost:4001
# .env.production
VITE_API_URL=https://curavia-backend.vercel.app
```

## API Documentation

All routes under `/api/v1`, JSON, Bearer JWT.

**Auth**

- `POST /api/v1/auth/register` — {email,password,name,role? PATIENT|DOCTOR|ADMIN} -> 201 {user, token}
- `POST /api/v1/auth/login` — {email,password} -> 200 {user, token}
- `GET /api/v1/auth/me` — Header Authorization: Bearer TOKEN -> 200 {user}

**Doctors**

- `GET /api/v1/doctors?specialisation=&date=` — public, list doctors with user
- `GET /api/v1/doctors/:id` — doctor detail
- `GET /api/v1/doctors/:id/availability?date=YYYY-MM-DD` — computed slots from workingHours minus HELD/CONFIRMED (holdExpiresAt>now) and leaves -> [{start,end}]

**Appointments (Booking Engine)**

- `POST /api/v1/appointments/hold` — Auth PATIENT/ADMIN, {doctorId, slotStart (ISO), slotEnd?} -> 201 HELD holdExpiresAt +10m, 409 if slotTaken (unique P2002 or check). Mock checks active HELD/CONFIRMED, Prisma uses $transaction + findFirst + create.
- `POST /api/v1/appointments/:id/confirm` — {rawSymptoms,duration?,severity?,existingConditions?} -> 200 CONFIRMED + symptomForm (llmStatus SUCCESS|FAILED). 410 if hold expired. Triggers generatePreVisit + enqueue BOOKING_CONFIRMATION + calendar stub.
- `POST /api/v1/appointments/:id/symptoms` — alias for confirm
- `GET /api/v1/appointments` — PATIENT own, DOCTOR own doctorId, ADMIN all; includes symptomForm/visitNote
- `GET /api/v1/appointments/:id` — detail
- `POST /api/v1/appointments/:id/cancel` — sets CANCELLED, deletes calendar best-effort, enqueues CANCELLATION
- `GET /api/v1/health` and `/health` — status, mockMode

**Visits**

- `POST /api/v1/visits/:appointmentId` — Auth DOCTOR/ADMIN, {clinicalNotes, prescription:[{drug,dosage,frequency,duration}]} -> 201 visitNote with generatePostVisit (patientSummary, llmStatus), creates medicationReminders (nextSendAt +5m), appointment -> COMPLETED, enqueues notification

**Doctor Leaves**

- `POST /api/v1/doctor-leaves` — {doctorId,startDate,endDate?,reason?} -> 201 {leave,cancelledCount}, cancels overlapping HELD/CONFIRMED -> CANCELLED, enqueues LEAVE_CANCELLATION, audit log, calendar delete best-effort
- `GET /api/v1/doctor-leaves` — list

**Admin**

- `GET /api/v1/admin/stats` — {users,doctors,appointments,failedNotifications}
- `GET /api/v1/admin/appointments` — all with filters
- `GET /api/v1/admin/notifications` — logs PENDING/SENT/FAILED
- `POST /api/v1/admin/doctors` — create doctor {email,password,name,specialisation,slotDurationMinutes,consultationFee}

**Calendar**

- `GET /api/v1/calendar/auth` — redirect to Google OAuth
- `GET /api/v1/calendar/callback?code=` — exchange, encrypt refresh_token, store
- POST/DELETE calendar events via services/calendar.ts (stub if no creds)

Example hold:

```bash
curl -X POST http://localhost:4001/api/v1/appointments/hold \
 -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
 -d '{"doctorId":"d1","slotStart":"2026-08-26T09:00:00.000Z"}'
```

## DB Schema (Prisma)

```prisma
model User { id, email @unique, password, name, role (PATIENT|DOCTOR|ADMIN), createdAt, patientAppointments[], doctorProfile?, auditLogs[] }
model DoctorProfile { id, userId @unique, specialisation, workingHours Json, slotDurationMinutes, consultationFee, bio, appointments[], leaves[] }
model DoctorLeave { id, doctorId, startDate @db.Date, endDate @db.Date, reason, @@index([doctorId]) }
model Appointment { id, patientId, doctorId, slotStart, slotEnd, status (HELD|CONFIRMED|CANCELLED|COMPLETED), holdExpiresAt, @@unique([doctorId, slotStart]), @@index([doctorId,slotStart]), @@index([patientId]), @@index([status]) }
model SymptomForm { id, appointmentId @unique, rawSymptoms, structured Json?, urgencyLevel, llmStatus, llmRaw, createdAt }
model VisitNote { id, appointmentId @unique, clinicalNotes, prescription Json?, patientSummary, patientSummaryJson Json?, llmStatus, reminders[] }
model MedicationReminder { id, visitNoteId, drug, dosage, frequency, duration, nextSendAt, status (PENDING|SENT|CANCELLED), @@index([nextSendAt]) }
model NotificationLog { id, type, recipient, channel EMAIL, status PENDING|SENT|FAILED, retryCount, relatedEntity/Id, payload Json?, @@index([status]) }
model CalendarEvent { id, appointmentId, googleEventId?, ownerEmail, syncStatus PENDING|SYNCED|FAILED }
model AuditLog { id, action, actorId, targetType/Id, details Json? }
```

ERD: User 1-0..1 DoctorProfile 1-* Appointment *-1 DoctorProfile, User 1-* Appointment, Appointment 1-0..1 SymptomForm/VisitNote, VisitNote 1-* MedicationReminder.

## Exact LLM Prompts (Verbatim)

**Pre-visit (on symptom confirm, shown to doctor):**

> Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>

System: You are a medical triage assistant. Return only valid JSON. Keys: urgencyLevel, chiefComplaint, suggestedQuestions (array 3). JSON mode + schema validation. Code: services/llm.ts `generatePreVisit`.

**Post-visit (on clinical notes, shown to patient):**

> Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>
> Prescription: <prescription JSON>

System: You are a clinical summarizer. Return only valid JSON, patient-friendly language. Keys: summary, medicationSchedule (array {drug,dose,timing,duration}), followUpInstructions.

**Failure handling:** try/catch timeout 10s (callWithTimeout), retry max 1 (second prompt no markdown), fallback save with llmStatus FAILED, structured fallback (urgency heuristic / summary unavailable), UI retry state not blocking booking/visit. Booking returns 201 even if LLM fails.

## Google OAuth Step-by-Step

1. console.cloud.google.com -> New Project CuraVia
2. APIs & Services -> Enable Google Calendar API
3. OAuth consent screen -> External, app name CuraVia Health, support email, scopes .../auth/calendar.events
4. Credentials -> Create OAuth client ID -> Web application -> Authorized redirect URI: http://localhost:4001/api/v1/calendar/callback (and production https://backend/api/v1/calendar/callback)
5. Copy Client ID/Secret -> backend .env GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_ENCRYPTION_KEY (32-char hex for token encrypt)
6. Flow: patient/doctor hits GET /api/v1/calendar/auth -> redirect Google consent -> callback ?code= -> server exchanges for access_token+refresh_token, encrypts refresh, stores (mock calendarEvents SYNCED), best-effort create/update/delete events on booking/visit/leave/cancel. If creds empty, stub logs + booking still succeeds.

## Seeded Demo Accounts

| Role | Email | Password | Detail |
|------|-------|----------|--------|
| ADMIN | cura.admin@curavia.health | admin123 | Admin Cura |
| PATIENT | sofia@curavia.health | patient123 | Sofia Rivera |
| PATIENT | marcus@curavia.health | patient123 | Marcus Chen |
| DOCTOR | elena.rossi@curavia.health | doctor123 | Dr. Elena Rossi, Cardiology, 30m, $650, 12y interventional |
| DOCTOR | amir.khan@curavia.health | doctor123 | Dr. Amir Khan, Dermatology, 20m, $450, cosmetic & clinical |
| DOCTOR | priya.desai@curavia.health | doctor123 | Dr. Priya Desai, General Medicine, 25m, $350, primary care |

WorkingHours: Mon-Fri 09:00-17:00, Sat 09:00-13:00, Sun off; distinct slotDuration/fees per doctor.

## Deployment

- **Frontend:** Vercel static-build, vercel.json builds frontend/package.json distDir dist, routes /assets/* -> dist, /* -> index.html. Env: VITE_API_URL=https://health-care-oppoinment-7qu4aa.vercel.app
- **Backend:** health GET /health and /api/v1/health return {status:ok,mockMode,timestamp}. For Vercel, api/index.ts exports app; else app.listen(PORT).
- **Local:** docker-compose.yml optional postgres:15 curavia/curavia and redis:7 (not needed in mock mode)
- **Live URLs:** Frontend https://health-care-oppoinment.vercel.app/ (Vercel akshata10), Backend https://health-care-oppoinment-7qu4aa.vercel.app/ (health at /health), Health https://health-care-oppoinment-7qu4aa.vercel.app/health

## Design Tokens

- --primary #2D6A4F, --primary-dark #1B4332, --primary-light #D8F3DC, --accent #E07A5F, --accent-light #F4ACB7, --bg #FEFAE0 cream, --card #FFFFFF, --text #264653 charcoal, --muted #6B7C6E, --border #E9E5D6, --radius 16px, --shadow 0 8px 30px rgba(45,106,79,0.08)
- Fonts: Fraunces 600/700 (headings) + Plus Jakarta Sans 400/500/600/700 (body)
- Components: .card hover lift, .btn gradient sage, .slot available/selected/booked, .badge-low/medium/high (Low #D8F3DC, Medium #FAEDCD, High #FADCD9 pulse), .skeleton shimmer, .hero gradient sage->clay

## Scripts

Backend: `npm run dev` (tsx watch), `npm run build` (tsc), `npm start` (node dist/server), `npm run seed`, `npm test`
Frontend: `npm run dev` (vite 5174), `npm run build` (vite build), `npm run preview`

## Verification

```bash
# Backend tsc
cd backend && npx tsc --noEmit # should be 0
# Frontend vite
cd frontend && npm run build # 2762 modules
# Tests (require server on 4001)
node backend/tests/concurrent-booking.js # 1 201 1 409 PASS
node backend/tests/leave-cancellation.js # cancelledCount 1 PASS
node backend/tests/llm-fallback.js # booking succeeds, urgency High PASS
```

---
Built for portfolio - not medical advice. Sage & Clay theme distinct from teal/indigo prior builds.
