import { History, X } from "lucide-react";

import { Button } from "@/components/ui/button";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUnitRecordsModal({
  entries = [],
  onClose,
  totalApproved = 0,
  unit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="flex max-h-[82vh] w-full max-w-[940px] flex-col overflow-hidden rounded-[1.75rem] bg-[#edf4f3] shadow-[0_24px_70px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#1f2f74] via-[#243b86] to-[#2a4694] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/18 p-3">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{unit} Approved Entries</h3>
              <p className="mt-1 text-sm text-white/75">
                Entries approved against this unit allocation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/85 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1 border-b border-slate-200/80 bg-white px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Approved</p>
            <p className="text-2xl font-bold text-slate-900">₱{formatCurrency(totalApproved)}</p>
          </div>
          <p className="text-sm text-slate-500">{entries.length} approved entries</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <table className="w-full table-fixed overflow-hidden rounded-2xl bg-white text-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <colgroup>
              <col />
              <col className="w-[110px]" />
              <col className="w-[150px]" />
              <col className="w-[165px]" />
            </colgroup>
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 text-left font-semibold text-slate-700">Title</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-700">No.</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-700">Submitted</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400">
                    <History className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>No approved entries yet</p>
                    <p className="text-sm">Approved entries for {unit} will appear here.</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="truncate px-5 py-3 font-medium text-slate-800">
                      {entry.titleOfActivities || "-"}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-600">
                      {entry.no || "-"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(entry.submittedAt)}
                    </td>
                    <td className="px-5 py-3 font-semibold text-red-600">
                      ₱{formatCurrency(entry.grandTotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200/80 bg-white p-4">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="w-full rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
