import { useMemo, useState } from "react";
import { History, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeUnitCode } from "@/lib/units";

function formatRecordDateTime(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AdminBudgetRecordsModal({
  approvedEntries = [],
  onClose,
  totalBudget = 0,
  transactions = [],
}) {
  const [activeTab, setActiveTab] = useState("movements");

  const handleClose = () => {
    onClose?.();
  };

  const transactionRows = useMemo(
    () =>
      transactions.map((tx) => (
        <tr
          key={tx.id}
          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
        >
          <td className="whitespace-nowrap px-6 py-3 text-slate-600">
            {formatRecordDateTime(tx.created_at)}
          </td>
          <td className="px-6 py-3 text-center">
            <Badge className="inline-flex min-w-16 justify-center bg-slate-100 text-slate-700">
              {normalizeUnitCode(tx.unit)}
            </Badge>
          </td>
          <td className="px-6 py-3 text-center">
            <Badge
              className={
                tx.type === "ADDED"
                  ? "inline-flex min-w-20 justify-center bg-green-100 text-green-700"
                  : "inline-flex min-w-20 justify-center bg-red-100 text-red-700"
              }
            >
              {tx.type}
            </Badge>
          </td>
          <td
            className={`px-6 py-3 font-semibold ${
              tx.type === "ADDED" ? "text-green-600" : "text-red-600"
            }`}
          >
            {tx.type === "ADDED" ? "+" : "-"}₱
            {Number(tx.amount).toLocaleString()}
          </td>
          <td className="px-6 py-3 text-slate-600">{tx.description}</td>
        </tr>
      )),
    [transactions],
  );

  const approvedEntryRows = useMemo(
    () =>
      approvedEntries.map((entry) => (
        <tr
          key={entry.id}
          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
        >
          <td className="truncate px-5 py-3 font-medium text-slate-800">
            {entry.titleOfActivities || "-"}
          </td>
          <td className="px-5 py-3 text-center text-slate-600">{entry.no || "-"}</td>
          <td className="px-5 py-3 text-center">
            <Badge className="inline-flex min-w-16 justify-center bg-slate-100 text-slate-700">
              {normalizeUnitCode(entry.unit)}
            </Badge>
          </td>
          <td className="px-5 py-3 text-center text-slate-600">
            {entry.planningYear || "-"}
          </td>
          <td className="px-5 py-3 text-slate-600">
            {entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString() : "-"}
          </td>
          <td className="px-5 py-3 font-semibold text-red-600">
            ₱{formatCurrency(entry.grandTotal)}
          </td>
        </tr>
      )),
    [approvedEntries],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[1.75rem] bg-[#edf4f3] shadow-[0_24px_70px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#6ea3a6] via-[#4f8f93] to-[#2f7f86] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/18 p-3">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Budget Records</h3>
              <p className="mt-1 text-sm text-white/80">
                Track budget movements and approved deductions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-2 text-white/85 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-white px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("movements")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === "movements"
                  ? "bg-[#233f8f] text-white shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-700"
              }`}
            >
              Budget Movements
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("deductions")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === "deductions"
                  ? "bg-[#233f8f] text-white shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-700"
              }`}
            >
              Approved Entries
            </button>
          </div>
          <Badge className="w-fit border-0 bg-[#e4eef0] px-4 py-2 text-base text-[#0b4f52]">
            Total: ₱{formatCurrency(totalBudget)}
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className={activeTab === "movements" ? "block" : "hidden"}>
            <table className="w-full table-fixed overflow-hidden rounded-2xl bg-white text-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
              <colgroup>
                <col className="w-[190px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
                <col className="w-[150px]" />
                <col />
              </colgroup>
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-700">Unit</th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-700">Type</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">Amount</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-700">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400">
                      <History className="mx-auto mb-3 h-12 w-12 opacity-50" />
                      <p>No transactions yet</p>
                      <p className="text-sm">Add budget to units to get started</p>
                    </td>
                  </tr>
                ) : transactionRows}
              </tbody>
            </table>
          </div>

          <div className={activeTab === "deductions" ? "block" : "hidden"}>
            <table className="w-full table-fixed overflow-hidden rounded-2xl bg-white text-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
              <colgroup>
                <col />
                <col className="w-[110px]" />
                <col className="w-[130px]" />
                <col className="w-[110px]" />
                <col className="w-[170px]" />
                <col className="w-[150px]" />
              </colgroup>
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">
                    Title
                  </th>
                  <th className="px-5 py-3 text-center font-semibold text-slate-700">No.</th>
                  <th className="px-5 py-3 text-center font-semibold text-slate-700">Unit</th>
                  <th className="px-5 py-3 text-center font-semibold text-slate-700">Year</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">
                    Date Submitted
                  </th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {approvedEntries.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      <History className="mx-auto mb-3 h-12 w-12 opacity-50" />
                      <p>No approved entries yet</p>
                    </td>
                  </tr>
                ) : approvedEntryRows}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-slate-200/80 bg-white p-4">
          <Button
            type="button"
            onClick={handleClose}
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
