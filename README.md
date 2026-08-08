# MediQueue — Hospital Queue Management System

A web-based hospital queue management system built with React, TypeScript, and Supabase. Designed to digitize patient check-in, provide real-time queue tracking, and streamline staff workflows across hospital departments.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL, Auth, Realtime subscriptions)
- **UI Libraries**: Framer Motion, Lucide React, React Router DOM v7
- **SMS**: Arkesel API (Ghana)

## Features

### Patient-Facing
- **Digital Check-In** — Select department, enter details, get queue number
- **Real-Time Queue Tracker** — Live position updates via Supabase Realtime
- **Icon-Based Stage Stepper** — Visual progress through check-in → consult → lab → pharmacy → done
- **Phone Deduplication** — Same phone number finds existing active token
- **SMS Notifications** — Token sent via SMS on check-in, reminder when called
- **Audio Alerts** — "Now serving" tone when your turn approaches
- **Mobile Responsive** — Works on phones and tablets

### Staff Portal
- **Call Next Patient** — Call, select, or mark patients as served
- **Multi-Stage Journey** — Send patients to Lab, Pharmacy, or mark visit complete
- **Auto Re-queue** — No-show button sends patient back to waiting queue
- **Staff Assignment** — Patients automatically assigned to the staff who called them
- **Live Queue View** — Real-time waiting list per department
- **Priority Handling** — Emergency and priority patient flags

### Admin Dashboard
- **Queue Management** — Search, filter, reorder, batch actions
- **Department-Scoped KPIs** — Stats filtered by selected department
- **Reports & Analytics** — Department breakdown, status distribution, hourly check-ins
- **Staff Management** — Invite staff (creates real Supabase Auth accounts), view roster
- **Emergency Override** — Flag patients as emergency with audit logging
- **Patient-Staff Mapping** — See which staff member is assigned to each patient

## Getting Started

```bash
npm install
cp .env.production .env  # configure Supabase credentials
npm run dev               # start dev server at http://localhost:5173
```

## Environment Variables

Create a `.env` file with:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Nurse | staff@demo.com | staff1234 |
| Doctor | doctor@demo.com | doctor1234 |
| Pharmacist | pharmacist@demo.com | pharma1234 |
| Lab Tech | lab@demo.com | lab1234 |

## Project Structure

```
src/
├── pages/
│   ├── checkin/          # Patient self check-in + phone dedup
│   ├── queuetracker/     # Live queue position tracker with icons
│   ├── login/            # General login
│   ├── adminlogin/       # Admin-only login
│   ├── stafflogin/       # Staff-only login
│   ├── staffportal/      # Staff dashboard + multi-stage
│   ├── admindashboard/   # Admin control panel
│   ├── emergencyoverride/ # Emergency flagging with audit
│   ├── acceptinvite/     # Staff invite activation
│   └── notfound/         # 404 page
├── services/             # Supabase API layer
├── hooks/                # Realtime subscriptions
├── context/              # Auth state management
├── lib/                  # Supabase client, auth utils, invite
├── types/                # TypeScript definitions
└── styles/               # Design tokens
supabase/
└── migrations/           # Database schema + RLS + indexes
```

## Build & Deploy

```bash
npm run build    # TypeScript check + Vite production build
npm run preview  # Preview production build locally
```

Deployed to Netlify with automatic CI/CD from GitHub.

## License

Private — Mini Project, Kwame Nkrumah University of Science and Technology, 2026.
