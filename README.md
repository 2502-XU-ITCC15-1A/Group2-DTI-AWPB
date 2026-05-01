markdown
# AWPB System - DTI RAPID Growth Project

An Annual Work and Budget Plan (AWPB) management system for the DTI RAPID Growth Project, built with React and Supabase.

## Overview

The AWPB System is a web-based application that allows encoders to submit annual work and budget plans, and administrators to review, approve, or return submissions. The system manages complex hierarchical templates, monthly budget breakdowns, and user access control.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | Frontend framework |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Styling and UI components |
| **shadcn/ui** | UI component library |
| **Supabase** | Backend-as-a-Service (Auth + Database) |
| **React Hook Form** | Form management |
| **React Router DOM** | Routing and navigation |
| **Lucide React** | Icons |

## Project Status

| Component | Status | Completion |
|-----------|--------|------------|
| Frontend | 🟢 Functional | 95% |
| Database | 🟢 Functional | 95% |
| Backend | 🔴 Removed | 0% |

**Overall Status:** ✅ Ready for User Acceptance Testing (UAT)

---

## Working Features

### For Encoders

| Feature | Status | Description |
|---------|--------|-------------|
| Login | ✅ | Username/password authentication |
| Submit Entry | ✅ | Complete AWPB entry form with 3-step wizard |
| Monthly Budget Computation | ✅ | Unit Cost × Monthly Target = Amount |
| Monthly Breakdown Display | ✅ | Shows targets and amounts in table |
| Grand Total Calculation | ✅ | Sum of all monthly amounts |
| View My Entries | ✅ | List of all submitted entries |
| Entry Status Tracking | ✅ | Shows Pending/Returned/Approved/Rejected |
| Edit Returned Entries | ✅ | All fields pre-populate when editing |
| Delete Pending Entries | ✅ | Can delete entries not yet reviewed |
| View Entry Details | ✅ | Modal with complete entry information |

### For Administrators

| Feature | Status | Description |
|---------|--------|-------------|
| Admin Dashboard | ✅ | Overview with statistics and budgets |
| Review Entries | ✅ | Table with all submissions |
| No. Column | ✅ | Shows activity number from template |
| Sub Activity Column | ✅ | Shows sub-activity from template |
| Monthly Breakdown in Review | ✅ | Displays targets and amounts |
| Approve Entries | ✅ | Changes status to "Approved" |
| Return Entries | ✅ | Changes status to "Returned" with comments |
| Reject Entries | ✅ | Changes status to "Rejected" with comments |
| Manage Template | ✅ | CRUD for components, sub-components, key activities |
| Manage Accounts | ✅ | Create, edit, activate, deactivate users |
| Submission Window Control | ✅ | Open/close encoding periods |
| Filter Entries | ✅ | By status, unit, year |
| Budget by Unit | ✅ | Dashboard shows approved budgets per unit |

### Database

| Feature | Status | Description |
|---------|--------|-------------|
| Supabase Integration | ✅ | Cloud database with real-time |
| Row Level Security | ✅ | Policies for encoders and admins |
| Foreign Key Relationships | ✅ | Properly linked tables |
| Monthly Targets | ✅ | Stored separately for each entry |
| Template Hierarchy | ✅ | 4-level nested structure |
| User Profiles | ✅ | Extended auth users with roles |

---

## Features Needing Fix

### High Priority

| Issue | Description | Impact | Suggested Fix |
|-------|-------------|--------|----------------|
| `handle_new_user` Trigger | Trigger doesn't fire for users created via admin API | Admin-created users need manual profile creation | Modify trigger or create profiles programmatically |
| RLS Warnings in Dashboard | Reference tables show "RLS Disabled" warnings | Cosmetic only, no functionality impact | Add SELECT-only RLS policies |

### Low Priority

| Issue | Description | Impact | Suggested Fix |
|-------|-------------|--------|----------------|
| Forgot Password | Feature exists but untested | Password reset flow not verified | Test and implement email reset |
| Audit/History Table | No tracking of entry changes | Cannot see who changed what | Create audit trigger and table |
| Legacy Backend Code | Express server files still in repo | Clutter, not used | Delete `backend/` folder |
| Legacy Database Files | Old SQL files in root `database/` folder | Clutter, not used | Delete folder |




Project Structure
text
frontend/
├── src/
│   ├── assets/           # Images and static files
│   ├── components/       # Reusable UI components
│   │   ├── admin/        # Admin-specific components
│   │   ├── entries/      # Entry-related components
│   │   ├── layout/       # Layout components
│   │   └── ui/           # shadcn/ui components
│   ├── data/             # JSON data files
│   ├── lib/              # Utility functions
│   ├── pages/            # Page components
│   │   ├── Login.jsx
│   │   ├── Home.jsx
│   │   ├── SubmitEntry.jsx
│   │   ├── MyEntries.jsx
│   │   ├── AdminReview.jsx
│   │   ├── AdminDashboard.jsx
│   │   ├── ManageTemplate.jsx
│   │   ├── ManageAccounts.jsx
│   │   └── AddNewAccount.jsx
│   ├── services/         # API services
│   │   └── supabaseService.js
│   ├── App.jsx           # Main app component
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Public assets
├── .env                  # Environment variables
├── package.json
└── vite.config.js

supabase/
└── migrations/           # Database migration files
    ├── 001_create_awpb_schema.sql
    ├── 002_seed_template_data.sql
    ├── 003_rls_policies.sql
    ├── 004_fix_rls_recursion.sql
    ├── 005_awpb_entries.sql
    └── 006_username_to_email_rpc.sql

    
**User Roles**
Encoder
Username prefix: enc_ (e.g., enc_jdelacruz)

Can submit and edit own entries

Can view own submission status

Can edit returned entries

Admin
Username prefix: adm_ (e.g., adm_admin)

Can review all entries

Can manage template hierarchy

Can manage user accounts

Can configure submission windows

Can view dashboard statistics

Key Features
Submission Window Control
Admins can open/close encoding periods. When closed, encoders cannot submit new entries or edit returned ones.

Monthly Budget Computation
Unit Cost × Monthly Target = Monthly Amount

Grand Total = Sum of all monthly amounts

Only months with targets > 0 are saved

Template Management
Admins can manage the 4-level hierarchy:

Components

Sub-components

Key Activities (with Activity No. and Performance Indicator)

Sub-activities

Entry Review Workflow
Encoder submits entry → Status: "Pending Review"

Admin reviews → Can Approve, Return, or Reject

If Returned, encoder can edit and resubmit

If Approved/Rejected, entry is locked


- ✅ Troubleshooting guide
- ✅ Useful SQL queries
