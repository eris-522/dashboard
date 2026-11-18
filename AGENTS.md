@[../AGENTS.md](../AGENTS.md)

# Admin & Staff Dashboard (`dashboard/`) Context

Key entry points and files in this sub-repository:
- `src/App.tsx` — Dashboard shell, persistent navigation rail, and RBAC-protected routes.
- `src/context/BookingContext.tsx` — Central booking state, status transitions, payment verification, and billing synchronization.
- `src/pages/BookingPage.tsx` — Master inquiry drawer, deposit/final balance slip verification, logistics & overtime adjustments, and dish substitutions.
- `src/pages/CMSPage.tsx` — Live website content and announcement broadcast manager.
- `src/utils/contractPdfGenerator.ts` — Client-side jsPDF generator for the 20-clause Catering Service Agreement.
- `src/utils/auditLogger.ts` — Security audit trail writer (`audit_logs`).
