import { ClipboardCheck, LayoutDashboard, LogOut } from "lucide-react";

export default function ChooseView({ currentUser, onChooseView, onLogout }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-r from-[#014b4c] via-[#0a5d60] to-[#4f9597] px-5 py-8 text-slate-900">
      <div className="w-full max-w-4xl rounded-[2rem] bg-white px-6 py-7 shadow-xl md:px-8 md:py-8">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[#2a6b71]">
              Signed in as {currentUser?.fullName || currentUser?.username || "Admin"}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#062f35]">
              Choose Your View
            </h1>
          </div>

          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut size={17} />
              Logout
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 pt-6 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onChooseView("admin")}
            className="group rounded-2xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-0.5 hover:border-[#233f8f]/40 hover:bg-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
          >
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#233f8f] text-white">
              <ClipboardCheck size={23} />
            </span>
            <span className="block text-2xl font-bold text-slate-950">
              Admin View
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-600">
              Review submissions, manage templates, update accounts, and view
              the admin dashboard.
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChooseView("encoder")}
            className="group rounded-2xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-0.5 hover:border-[#0a7774]/40 hover:bg-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
          >
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0a7774] text-white">
              <LayoutDashboard size={23} />
            </span>
            <span className="block text-2xl font-bold text-slate-950">
              Account Officer View
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-600">
              Open the encoder workspace for home, entries, and AWPB submission
              tasks using this same admin account.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
