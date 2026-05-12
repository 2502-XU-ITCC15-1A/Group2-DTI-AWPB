import { Wallet, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AdminUnitAllocationModal({
  adjustmentType = "ADDED",
  amount,
  description,
  onAmountChange,
  onClose,
  onDescriptionChange,
  onSave,
  onTypeChange,
  remaining = 0,
  unit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="w-full max-w-[720px] overflow-hidden rounded-[1.75rem] bg-[#edf4f3] shadow-[0_24px_70px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#1f2f74] via-[#243b86] to-[#2a4694] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/18 p-3">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Edit Allocation — {unit}</h3>
              <p className="mt-1 text-sm text-white/75">
                Adjust this unit's remaining approval limit.
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

        <div className="border-b border-slate-200/80 bg-white px-6 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Current Remaining</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                ₱{formatCurrency(remaining)}
              </p>
            </div>
            <p className="max-w-[320px] text-sm text-slate-500">
              This is the available amount left for approving entries under {unit}.
            </p>
          </div>
        </div>

        <div className="grid gap-5 px-6 py-6 md:grid-cols-[220px_1fr]">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Adjustment type
            </label>
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => onTypeChange?.("ADDED")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  adjustmentType === "ADDED"
                    ? "bg-[#233f8f] text-white shadow-sm"
                    : "text-slate-500 hover:bg-white hover:text-slate-700"
                }`}
              >
                Add Funds
              </button>
              <button
                type="button"
                onClick={() => onTypeChange?.("DEDUCTED")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  adjustmentType === "DEDUCTED"
                    ? "bg-[#233f8f] text-white shadow-sm"
                    : "text-slate-500 hover:bg-white hover:text-slate-700"
                }`}
              >
                Subtract Funds
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Amount (₱)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(event) => onAmountChange?.(event.target.value)}
              className="h-12 rounded-xl border-slate-200 bg-white text-lg font-medium"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Description
            </label>
            <Input
              type="text"
              placeholder={
                adjustmentType === "ADDED"
                  ? `Additional allocation for ${unit}`
                  : `Allocation reduction for ${unit}`
              }
              value={description}
              onChange={(event) => onDescriptionChange?.(event.target.value)}
              className="h-12 rounded-xl border-slate-200 bg-white"
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-200/80 bg-white p-4">
          <Button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-xl border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] text-white hover:from-[#19265f] hover:to-[#213a80]"
          >
            Save Adjustment
          </Button>
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="flex-1 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
