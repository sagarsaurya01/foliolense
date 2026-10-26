# Decisions

Dated record of choices the PRD doesn't settle on its own.

| Date | Decision | Why |
|---|---|---|
| 26-Oct-2026 | New private repo `foliolense`; old `foliolens` archived | Old repo predates the approved design; cheaper to start clean |
| 26-Oct-2026 | Personal use only in v1: no domain, no payments | Family tool first |
| 26-Oct-2026 | Supabase free plan; weekly backup to Google Drive | Free plan has no backups |
| 26-Oct-2026 | Build and run on the laptop (localhost); deploy to Railway only at go-live (Phase 7) | Nothing to pay or maintain until it's finished |
| 26-Oct-2026 | Railway account is Ajay's (laddhaajay@gmail.com); only a new `foliolense` project is ever touched | The account runs 7 other live projects |
| 26-Oct-2026 | Stack option A: TypeScript (Next.js) for the app, Python only for the statement-reading and price worker | `casparser` (MIT, Python) already reads CAMS/KFintech CAS and NSDL/CDSL e-CAS; writing that in TypeScript would add 1–2 weeks and risk |
