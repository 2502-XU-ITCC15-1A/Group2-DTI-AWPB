import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminEditUserModal({
  open,
  onOpenChange,
  form,
  errors,
  onFieldChange,
  onSave,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-3 py-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.32)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b bg-white px-6 py-5 md:px-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Edit User Account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Update user details and role assignment.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 px-6 py-6 md:px-8 md:py-7 xl:grid-cols-[1.2fr_0.8fr] xl:gap-10">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Username
              </label>
              <Input
                name="username"
                value={form.username}
                onChange={onFieldChange}
                placeholder="enc_jdelacruz"
                className="h-11 rounded-xl border-slate-200 bg-white px-4"
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-600">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Full Name
              </label>
              <Input
                name="fullName"
                value={form.fullName}
                onChange={onFieldChange}
                placeholder="Enter full name"
                className="h-11 rounded-xl border-slate-200 bg-white px-4"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Email
              </label>
              <Input
                name="email"
                type="email"
                value={form.email}
                onChange={onFieldChange}
                placeholder="Enter email"
                className="h-11 rounded-xl border-slate-200 bg-white px-4"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <Input
                name="password"
                type="password"
                value={form.password}
                onChange={onFieldChange}
                placeholder="New password"
                className="h-11 rounded-xl border-slate-200 bg-white px-4"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Confirm Password
              </label>
              <Input
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={onFieldChange}
                placeholder="Confirm password"
                className="h-11 rounded-xl border-slate-200 bg-white px-4"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Role
              </label>
              <select
                name="role"
                value={form.role}
                onChange={onFieldChange}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              >
                <option value="admin">Admin</option>
                <option value="encoder">Account Officer</option>
              </select>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 xl:min-h-[230px]">
              <p className="text-sm font-semibold text-slate-800">
                Account Notes
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Use `enc_` for Account Officer accounts and `adm_` for admin accounts.
                Each email should belong to one account. Admins can switch
                between Admin and Account Officer views after login. Leave the
                password fields blank if there are no password changes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 rounded-b-[2rem] border-t bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end md:px-8">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            className="rounded-xl border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] px-5 text-white hover:from-[#19265f] hover:to-[#213a80]"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
