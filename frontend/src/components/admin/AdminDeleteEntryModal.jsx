import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AdminDeleteEntryModal({
  busy = false,
  open,
  onOpenChange,
  entry,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-4"
      onClick={() => !busy && onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[1.75rem] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.32)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between rounded-t-[1.75rem] border-b bg-white px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Deleting Entry
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to delete this submitted entry?
            </p>
          </div>

          <button
            type="button"
            onClick={() => !busy && onOpenChange(false)}
            disabled={busy}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6">
          {entry && (
            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">
                {entry.titleOfActivities}
              </p>
              <p className="mt-1 text-slate-600">
                {entry.unit} • {entry.planningYear || "N/A"}
              </p>
              <p className="mt-1 text-slate-500">{entry.status}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 rounded-b-[1.75rem] border-t bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-wait disabled:opacity-75"
          >
            {busy ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
