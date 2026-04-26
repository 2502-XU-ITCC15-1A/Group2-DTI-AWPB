



# 📊 Project progress status

## 🎨 Frontend — 🟢 **Most complete** (~80%)

Fully built React app with these pages:

| Page | Purpose |
|---|---|
| [Login.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/Login.jsx:0:0-0:0) | ✅ Working (confirmed yesterday) |
| [ForgotPassword.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/ForgotPassword.jsx:0:0-0:0) | ⚠️ Exists but untested |
| [Home.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/Home.jsx:0:0-0:0) | ✅ Landing/dashboard |
| [AdminDashboard.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/AdminDashboard.jsx:0:0-0:0) | ✅ Admin view |
| [AdminReview.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/AdminReview.jsx:0:0-0:0) | Review entries |
| [ManageAccounts.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/ManageAccounts.jsx:0:0-0:0) | ⚠️ UI works, Add User is **buggy** (needs the fix we started) |
| [AddNewAccount.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/AddNewAccount.jsx:0:0-0:0) | Linked to the Add User bug |
| [ManageTemplate.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/ManageTemplate.jsx:0:0-0:0) | Edit components/sub-components |
| [MyEntries.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/MyEntries.jsx:0:0-0:0) | Encoder's entries |
| [SubmitEntry.jsx](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/pages/SubmitEntry.jsx:0:0-0:0) | Main form (biggest file — 41KB) |

**Data layer:** `@c:\Users\KateC\Desktop\slp-dti-awpb-system\frontend\src\services\supabaseService.js` — talks directly to Supabase.

---

## 🗄️ Backend — 🟡 **Legacy, mostly abandoned** (~0% used)

- One file: `@c:\Users\KateC\Desktop\slp-dti-awpb-system\backend\src\server.js` (27KB Express API)
- Was the **original** design (before Supabase migration)
- **Not currently used** — the frontend talks to Supabase directly, bypassing this entirely
- Still has a [.env](cci:7://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/backend/.env:0:0-0:0) with database URL, but nothing calls it

**Status:** Dead code. Either delete it or resurrect it for admin-only operations (e.g. to fix the Add User bug properly).

---

## 🗃️ Database — 🟢 **Set up and working** (~85%)

✅ **Live on Supabase cloud** (`engimvovjhbuozskneys.supabase.co`)

✅ All tables created:
- `profiles`, `entries`, `monthly_targets`, [components](cci:9://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/frontend/src/components:0:0-0:0), `sub_components`, `key_activities`, `sub_activities`, `units`, `submission_windows`

✅ Seed data loaded (components, units)

✅ RLS policies active

⚠️ **Known issues:**
1. `handle_new_user` trigger doesn't fire for users created via admin API (related to the Add User bug)
2. Some legacy files ([backend/database/](cci:9://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/backend/database:0:0-0:0), root [database/](cci:9://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/database:0:0-0:0)) still in repo — unused
3. Audit/history table not yet defined (future work)

---

## 🎯 TL;DR

```
Frontend  ████████░░ 80%  (built, mostly working, 1 known bug)
Backend   █░░░░░░░░░ 10%  (exists but unused — legacy)
Database  ████████░░ 85%  (deployed, seeded, minor cleanup needed)
```

**Architecture in use today:**

```
React frontend ──► Supabase (DB + Auth + RLS)
```

Backend Express server is sitting dormant. If your team decides to use it again (for admin operations like "Add User"), that's a design decision for the team — not your concern as the database person.

---

## 🎯 What this means for you

Your job: keep [supabase/migrations/](cci:9://file:///c:/Users/KateC/Desktop/slp-dti-awpb-system/supabase/migrations:0:0-0:0) clean, add new migration files for any schema changes, and verify the database matches what the frontend expects. You're in good shape. 👍
