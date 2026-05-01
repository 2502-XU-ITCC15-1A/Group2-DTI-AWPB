📊 Project progress status
🎨 Frontend — 🟢 Fully functional (~95%)
Fully built React app with these pages:

Page	Purpose	Status
Login.jsx	User authentication	✅ Working
ForgotPassword.jsx	Password reset	⚠️ Exists but untested
Home.jsx	Encoder dashboard	✅ Working
AdminDashboard.jsx	Admin overview	✅ Working
AdminReview.jsx	Review entries	✅ Working (No. & Sub Activity columns added)
ManageAccounts.jsx	User management	✅ Working
AddNewAccount.jsx	Create new users	✅ Working
ManageTemplate.jsx	Edit components/sub-components	✅ Working
MyEntries.jsx	Encoder's entries	✅ Working
SubmitEntry.jsx	Main entry form	✅ Working (Edit functionality fixed)
Data layer: supabaseService.js — talks directly to Supabase with full CRUD operations.

Fixed Issues:

✅ Monthly breakdown now displays correctly in both Admin and Encoder views

✅ No. and Sub Activity columns added to Admin Review table

✅ Edit returned entries now pre-populates all fields (Key Activity, No., Sub Activity)

✅ Resubmit functionality working with proper RLS policies

✅ Unit Cost and monthly targets persist when editing

🗄️ Backend — 🔴 Removed / Not used (0%)
The Express backend has been completely abandoned

Frontend communicates directly with Supabase for all operations

No backend services are required for the current architecture

Recommendation: Delete the backend/ folder to clean up the repository.

🗃️ Database — 🟢 Fully functional (~95%)
✅ Live on Supabase cloud (engimvovjhbuozskneys.supabase.co)

✅ All tables created and working:

profiles - User profiles with roles (admin/encoder)

entries - AWPB entries with foreign keys

monthly_targets - Monthly targets linked to entries

components, sub_components, key_activities, sub_activities - Template hierarchy

units - Implementing units

submission_windows - Submission period settings

✅ RLS policies active and working:

Encoders can update their own entries (for resubmission)

Admins can update all entries

Reference tables accessible to authenticated users

✅ Seed data loaded (components, units)

⚠️ Minor remaining issues:

handle_new_user trigger doesn't fire for users created via admin API (workaround: manual profile creation works)

Some legacy files (backend/database/, root database/) still in repo — can be removed

Audit/history table not yet defined (future enhancement)

🎯 TL;DR
text
Frontend  █████████░ 95%  (fully functional, all major features working)
Backend   ░░░░░░░░░░ 0%   (abandoned - can be removed)
Database  █████████░ 95%  (fully functional, minor cleanup optional)
Architecture in use today:

text
React frontend ──► Supabase (DB + Auth + RLS)
✅ Recent Fixes Applied
Issue	Solution
Monthly breakdown not showing	Modified getAll() and getById() to fetch from monthly_targets table and build breakdown dynamically
No. and Sub Activity missing in Admin Review	Added columns to table and mapped activity_no → no, sub_activities.name → subActivity
Edit form not pre-populating data	Updated useEffect to set values sequentially with delays for dependent dropdowns
RLS policy blocking updates	Created policies allowing encoders to update their own entries
Unit Cost and targets not loading on edit	Added target mapping from monthlyBreakdown to form targets object
