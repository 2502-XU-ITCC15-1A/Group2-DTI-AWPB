markdown
# AWPB System - DTI RAPID Growth Project

An Annual Work and Budget Plan (AWPB) management system for the DTI RAPID Growth Project, built with React and Supabase.

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Key Features](#key-features)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

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

## Features

### For Encoders
- ✅ Submit AWPB entries with hierarchical classification
- ✅ Enter monthly targets with automatic budget computation
- ✅ View all submitted entries with status tracking
- ✅ Edit returned entries with pre-populated data
- ✅ Delete pending entries
- ✅ View entry details

### For Administrators
- ✅ Review submitted entries (Approve/Return/Reject)
- ✅ Add review comments for returned/rejected entries
- ✅ Manage template hierarchy (Components, Sub-components, Key Activities)
- ✅ Manage user accounts (Create, Edit, Activate, Deactivate)
- ✅ Configure submission windows (Open/Close encoding periods)
- ✅ View dashboard with budget summaries and statistics
- ✅ Filter entries by status, unit, and year



text

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account (free tier works)

### Steps

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd slp-dti-awpb-system
Install frontend dependencies

bash
cd frontend
npm install
Create a Supabase project

Go to https://supabase.com

Create a new project

Save your project URL and anon key

Set up environment variables

Create frontend/.env file (see Environment Setup below)

Run database migrations

Copy migration files from supabase/migrations/ to Supabase SQL editor

Run in order: 001 through 006

Start the development server

bash
npm run dev
Environment Setup
Create frontend/.env file:

env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
Database Setup
Run Migrations in Order
Run these SQL files in your Supabase SQL editor:

Order	File	Purpose
1	001_create_awpb_schema.sql	Create all tables and enums
2	002_seed_template_data.sql	Load template hierarchy data
3	003_rls_policies.sql	Set up Row Level Security
4	004_fix_rls_recursion.sql	Fix RLS infinite recursion
5	005_awpb_entries.sql	Create entries table
6	006_username_to_email_rpc.sql	Create username lookup function
Default Admin Account
After migrations, create an admin user:

sql
-- Run in Supabase SQL editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  'admin@example.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"username": "adm_admin", "full_name": "System Admin", "role": "admin"}'
);
Running the Application
Development Mode
bash
cd frontend
npm run dev
App will run at http://localhost:5173

Production Build
bash
cd frontend
npm run build
Build output will be in dist/ folder

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
User Roles
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

Troubleshooting
Common Issues
Issue	Solution
Login fails	Check username exists in profiles table
Entries not showing	Verify RLS policies are applied
Monthly breakdown empty	Check monthly_targets table has data
Edit form not populating	Clear browser cache and refresh
RLS policy errors	Run migration 004_fix_rls_recursion.sql
Useful SQL Queries
sql
-- Check all entries
SELECT * FROM entries ORDER BY created_at DESC;

-- Check monthly targets
SELECT * FROM monthly_targets;

-- Check users
SELECT * FROM profiles;

-- Fix RLS issues
DROP POLICY IF EXISTS "Encoders update own entries" ON entries;
CREATE POLICY "Encoders update own entries" ON entries
    FOR UPDATE USING (auth.uid() = owner_id);
Contributing
Create a feature branch

Make your changes

Test thoroughly

Submit a pull request

Code Style
Use functional components with hooks

Follow existing naming conventions

Add console logs for debugging (remove before production)

Test both encoder and admin views

License
© Xavier University – Ateneo de Cagayan
In Fulfillment of SLP and ITCC project

Support
For issues or questions, contact the development team.

Acknowledgments
DTI RAPID Growth Project

Xavier University – Ateneo de Cagayan

Supabase for backend services

shadcn/ui for component library

Version: 1.0.0
Last Updated: May 2026
Status: Production Ready ✅

text

- ✅ Troubleshooting guide
- ✅ Useful SQL queries
