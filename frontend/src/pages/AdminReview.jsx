import { useEffect, useMemo, useState } from "react";
import { Search, Eye, Trash2, History, Pencil } from "lucide-react";
import { generateApprovedEntryPdf } from "../services/pdfService";
import { csvExportService } from "../services/csvService";

import AdminEntryReviewModal from "../components/admin/AdminEntryReviewModal";
import AdminDeleteEntryModal from "../components/admin/AdminDeleteEntryModal";
import AdminBudgetRecordsModal from "../components/admin/AdminBudgetRecordsModal";
import AdminUnitAllocationModal from "../components/admin/AdminUnitAllocationModal";
import AdminUnitRecordsModal from "../components/admin/AdminUnitRecordsModal";

import { supabase } from "../lib/supabase";
import { entriesService } from "../services/supabaseService";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UNIT_CODES, normalizeUnitCode } from "@/lib/units";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value) {
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

function formatUnitCode(unit) {
  return normalizeUnitCode(unit);
}

function getStatusBadgeVariant(status) {
  switch (status) {
    case "Pending Review":
      return "statusPending";
    case "Returned":
      return "statusReturned";
    case "Approved":
      return "statusApproved";
    case "Rejected":
      return "statusRejected";
    default:
      return "outline";
  }
}

function isApprovedStatus(status) {
  return String(status || "").trim().toLowerCase() === "approved";
}

const gradientButtonClass =
  "border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] text-white shadow-[0_6px_16px_rgba(31,47,116,0.28)] transition-all duration-200 hover:from-[#19265f] hover:to-[#213a80] hover:shadow-[0_10px_24px_rgba(31,47,116,0.38)]";

export default function AdminReview({
  currentUser,
  entries: entriesProp = [],
  onUpdateEntry,
  onDeleteEntry,
  onShowToast,
}) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [totalBudget, setTotalBudget] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Unit-specific budget state
  const UNITS = UNIT_CODES;
  const [unitBudgets, setUnitBudgets] = useState({});
  const [activeUnitBudgetModal, setActiveUnitBudgetModal] = useState(null);
  const [activeUnitHistoryModal, setActiveUnitHistoryModal] = useState(null);
  const [unitBudgetAmount, setUnitBudgetAmount] = useState("");
  const [unitBudgetDesc, setUnitBudgetDesc] = useState("");
  const [unitBudgetAdjustmentType, setUnitBudgetAdjustmentType] = useState("ADDED");

  const entries = entriesProp;
  const currentAdminId = currentUser?.id || null;

  const approvedEntries = useMemo(() => {
    return entries.filter((e) => isApprovedStatus(e.status));
  }, [entries]);

  const approvedBudgetByUnit = useMemo(() => {
    const totals = Object.fromEntries(UNITS.map((unit) => [unit, 0]));
    approvedEntries.forEach((entry) => {
      const unit = normalizeUnitCode(entry.unit);
      totals[unit] = (totals[unit] || 0) + Number(entry.grandTotal || 0);
    });
    return totals;
  }, [UNITS, approvedEntries]);

  const totalApprovedBudget = useMemo(() => {
    return Object.values(approvedBudgetByUnit).reduce((sum, value) => sum + value, 0);
  }, [approvedBudgetByUnit]);

  const unitAllocationStats = useMemo(() => {
    return Object.fromEntries(
      UNITS.map((unit) => {
        const remaining = Number(unitBudgets[unit] || 0);
        const approved = Number(approvedBudgetByUnit[unit] || 0);
        return [
          unit,
          {
            allocated: remaining + approved,
            approved,
            remaining,
          },
        ];
      }),
    );
  }, [UNITS, approvedBudgetByUnit, unitBudgets]);

  const totalAllocatedBudget = totalBudget + totalApprovedBudget;

  const approvedEntriesByUnit = useMemo(() => {
    return Object.fromEntries(
      UNITS.map((unit) => [
        unit,
        approvedEntries.filter((entry) => normalizeUnitCode(entry.unit) === unit),
      ]),
    );
  }, [UNITS, approvedEntries]);

  const availableUnits = useMemo(() => {
    return [...new Set(entries.map((entry) => normalizeUnitCode(entry.unit)).filter(Boolean))].sort();
  }, [entries]);

  const availableYears = useMemo(() => {
    return [...new Set(entries.map((entry) => entry.planningYear).filter(Boolean))]
      .sort((a, b) => String(b).localeCompare(String(a)));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesSearch =
        normalizedSearch === "" ||
        entry.titleOfActivities?.toLowerCase().includes(normalizedSearch) ||
        entry.performanceIndicator?.toLowerCase().includes(normalizedSearch) ||
        entry.subActivity?.toLowerCase().includes(normalizedSearch) ||
        normalizeUnitCode(entry.unit).toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || entry.status === statusFilter;

      const matchesUnit = unitFilter === "all" || normalizeUnitCode(entry.unit) === unitFilter;

      const matchesYear =
        yearFilter === "all" || String(entry.planningYear) === yearFilter;

      return matchesSearch && matchesStatus && matchesUnit && matchesYear;
    });
  }, [entries, searchTerm, statusFilter, unitFilter, yearFilter]);

  const persistEntryUpdate = async (entryId, uiUpdates, successToast) => {
    const dbUpdates = {
      status: uiUpdates.status,
      adminComment: uiUpdates.adminComment ?? "",
      reviewedAt: uiUpdates.reviewedAt,
      reviewerId: currentAdminId,
    };

    try {
      await entriesService.update(entryId, dbUpdates);
      onUpdateEntry?.(entryId, {
        ...uiUpdates,
        reviewerId: currentAdminId,
        reviewerUsername: currentUser?.username || "",
        reviewerFullName: currentUser?.fullName || "",
        reviewerDisplayName: currentUser?.fullName || currentUser?.username || "",
      });
      onShowToast?.(successToast);
      setSelectedEntry(null);
    } catch (err) {
      console.error("Failed to update entry in Supabase:", err);
      onShowToast?.({
        title: "Could not save changes",
        description: err.message || "Please try again.",
        type: "error",
      });
    }
  };

  const insertBudgetTransaction = async (transaction) => {
    const payload = {
      ...transaction,
      actor_id: currentAdminId,
    };

    let { error } = await supabase.from("budget_transactions").insert(payload);
    if (error?.message?.includes("actor_id") || error?.code === "PGRST204") {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.actor_id;
      const fallback = await supabase.from("budget_transactions").insert(fallbackPayload);
      error = fallback.error;
    }
    if (error) throw error;
  };

  const handleApprove = async (note) => {
  if (!selectedEntry) return;
  const entryAmount = selectedEntry.grandTotal || 0;
  const entryTitle = selectedEntry.titleOfActivities;
  const entryUnit = normalizeUnitCode(selectedEntry.unit);

  const unitBudget = unitBudgets[entryUnit] || 0;
  if (entryAmount > unitBudget) {
    onShowToast?.({
      title: "Insufficient allocation",
      description: `Need ₱${entryAmount.toLocaleString()} but ${entryUnit} only has ₱${unitBudget.toLocaleString()} remaining. Edit the unit allocation first.`,
      type: "error",
    });
    return;
  }
  
  try {
    await insertBudgetTransaction({
      amount: entryAmount,
      type: 'DEDUCTED',
      description: `Approved: ${entryTitle}`,
      unit: entryUnit,
    });
    
    await persistEntryUpdate(
      selectedEntry.id,
      {
        status: "Approved",
        adminComment: note || "",
        reviewedAt: new Date().toISOString(),
      },
      {
        title: "Entry approved",
        description: `${entryTitle} was approved successfully. ₱${entryAmount.toLocaleString()} deducted from ${entryUnit}'s remaining allocation.`,
        type: "success",
      }
    );
    
    await loadBudgetData();
    
  } catch (err) {
    console.error("Failed to approve entry:", err);
    onShowToast?.({
      title: "Could not approve entry",
      description: err.message || "Please try again.",
      type: "error",
    });
  }
};

  const handleGenerateApprovedEntry = async (entry) => {
    if (!isApprovedStatus(entry.status)) return;

    try {
      const { filename } = await generateApprovedEntryPdf(entry);
      onShowToast?.({
        title: "PDF generated",
        description: `${filename} is ready for printing.`,
        type: "success",
      });
    } catch {
      onShowToast?.({
        title: "PDF generation failed",
        description: "Could not generate the approved entry PDF.",
        type: "error",
      });
    }
  };

  const handleExportApprovedEntriesToCSV = async () => {
    try {
      const result = await csvExportService.exportApprovedEntriesToCSV();
      onShowToast?.({
        title: "CSV export successful",
        description: `Exported ${result.recordCount} approved entries to ${result.filename}`,
        type: "success",
      });
    } catch (error) {
      onShowToast?.({
        title: "CSV export failed",
        description: error.message || "Could not export approved entries to CSV.",
        type: "error",
      });
    }
  };
  
const reverseBudgetDeduction = async (entryTitle, amount, oldStatus, newStatus, entryUnit) => {
  try {
    await insertBudgetTransaction({
      amount: amount,
      type: 'ADDED',
      description: `REVERSAL: "${entryTitle}" changed from ${oldStatus} → ${newStatus}`,
      unit: normalizeUnitCode(entryUnit) || null,
    });
    
    onShowToast?.({
      title: "Allocation restored",
      description: `₱${amount.toLocaleString()} was added back to the allocation for: ${entryTitle}`,
      type: "success",
    });
    
    return true;
  } catch (err) {
    console.error("Failed to reverse allocation deduction:", err);
    onShowToast?.({
      title: "Could not restore allocation",
      description: err.message || "Please check the transaction history.",
      type: "error",
    });
    return false;
  }
};

  const handleReturn = async (note) => {
  if (!selectedEntry) return;
  const entryTitle = selectedEntry.titleOfActivities;
  const oldStatus = selectedEntry.status;
  const newStatus = "Returned";
  const entryAmount = selectedEntry.grandTotal || 0;

  // Check if it was approved and reverse allocation deduction if needed
  if (isApprovedStatus(oldStatus)) {
    console.log(`Entry was ${oldStatus}, reversing allocation deduction of ₱${entryAmount.toLocaleString()}`);
    const reversed = await reverseBudgetDeduction(entryTitle, entryAmount, oldStatus, newStatus, selectedEntry.unit);
    if (!reversed) {
      return; // Stop if reversal failed
    }
  }

  // Update the entry status (this runs for ALL returns, not just approved ones)
  await persistEntryUpdate(
    selectedEntry.id,
    {
      status: newStatus,
      adminComment: note,
      reviewedAt: new Date().toISOString(),
    },
    {
      title: "Entry returned",
      description: `${entryTitle} was returned for revision.${isApprovedStatus(oldStatus) ? ` ₱${entryAmount.toLocaleString()} restored to allocation.` : ""}`,
      type: "success",
    }
  );
  
  await loadBudgetData();
};

  const handleReject = async (note) => {
    if (!selectedEntry) return;
    const entryTitle = selectedEntry.titleOfActivities;
     const oldStatus = selectedEntry.status;
      const newStatus = "Rejected";
      const entryAmount = selectedEntry.grandTotal || 0;

      if(isApprovedStatus(oldStatus)) {
         console.log(`Entry was ${oldStatus}, reversing allocation deduction of ₱${entryAmount.toLocaleString()}`);
    const reversed = await reverseBudgetDeduction(entryTitle, entryAmount, oldStatus, newStatus, selectedEntry.unit);
    if (!reversed) return;
  }

  await persistEntryUpdate(
      selectedEntry.id,
      {
        status: newStatus,
        adminComment: note,
        reviewedAt: new Date().toISOString(),
      },
      {
        title: "Entry rejected",
        description: `${entryTitle} was rejected.${isApprovedStatus(oldStatus) ? ` ₱${entryAmount.toLocaleString()} restored to allocation.` : ""}`,
      type: "success",
      }
    );
    await loadBudgetData();
  };
    

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setUnitFilter("all");
    setYearFilter("all");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const entryTitle = deleteTarget.titleOfActivities;
    const entryAmount = Number(deleteTarget.grandTotal || 0);
    const entryStatus = deleteTarget.status;
    const entryUnit = normalizeUnitCode(deleteTarget.unit);
    const shouldRestoreAllocation = isApprovedStatus(entryStatus) && entryAmount > 0;

    try {
      if (shouldRestoreAllocation) {
        const reversed = await reverseBudgetDeduction(
          entryTitle,
          entryAmount,
          entryStatus,
          "Deleted",
          entryUnit,
        );
        if (!reversed) return;
      }

      await entriesService.delete(deleteTarget.id);
      onDeleteEntry?.(deleteTarget.id);
      await loadBudgetData();
      onShowToast?.({
        title: "Entry deleted",
        description: `${entryTitle} was removed successfully.${
          shouldRestoreAllocation
            ? ` ₱${entryAmount.toLocaleString()} was restored to ${entryUnit}'s allocation.`
            : ""
        }`,
        type: "success",
      });
      if (selectedEntry?.id === deleteTarget.id) {
        setSelectedEntry(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete entry from Supabase:", err);
      onShowToast?.({
        title: "Could not delete entry",
        description: err.message || "Please try again.",
        type: "error",
      });
    }
  };
  //connects sa supabase
  const loadBudgetData = async () => {
    try {
      let {data: txData, error: txError} = await supabase
        .from("budget_transactions")
        .select("*, actor:profiles!actor_id(username, full_name)")
        .order("created_at", { ascending: false });

      if (txError?.message?.includes("actor_id") || txError?.message?.includes("relationship")) {
        const fallback = await supabase
          .from("budget_transactions")
          .select("*")
          .order("created_at", { ascending: false });
        txData = fallback.data;
        txError = fallback.error;
      }

      if (txError) throw txError;

        // All unit transactions for the general View Records
        const allUnitTx = (txData || [])
          .filter((tx) => tx.unit)
          .map((tx) => ({ ...tx, unit: normalizeUnitCode(tx.unit) }));
        setTransactions(allUnitTx);

    // Per-unit remaining allocation calculation
    const budgets = {};
    UNITS.forEach((unit) => {
      const unitTx = (txData || [])
        .filter((tx) => normalizeUnitCode(tx.unit) === unit)
        .map((tx) => ({ ...tx, unit: normalizeUnitCode(tx.unit) }));
      let unitTotal = 0;
      unitTx.forEach((tx) => {
        if (tx.type === 'ADDED') {
          unitTotal += Number(tx.amount);
        } else if (tx.type === 'DEDUCTED') {
          unitTotal -= Number(tx.amount);
        }
      });
      budgets[unit] = unitTotal;
    });
    setUnitBudgets(budgets);

    // Total remaining allocation = sum of all unit remaining balances
    const grandTotal = UNITS.reduce((sum, u) => sum + (budgets[u] || 0), 0);
    setTotalBudget(grandTotal);

    } catch (err) {
      console.error("Failed to load allocation transactions:", err);
    }
  };
  const closeUnitAllocationModal = () => {
    setActiveUnitBudgetModal(null);
    setUnitBudgetAmount("");
    setUnitBudgetDesc("");
    setUnitBudgetAdjustmentType("ADDED");
  };

  const handleSaveUnitAllocation = async () => {
    const amount = parseFloat(unitBudgetAmount);
    const unit = activeUnitBudgetModal;
    if (!amount || amount <= 0) {
      onShowToast?.({
        title: "Invalid amount",
        description: "Please enter a valid allocation amount.",
        type: "error",
      });
      return;
    }

    if (unitBudgetAdjustmentType === "DEDUCTED" && amount > Number(unitBudgets[unit] || 0)) {
      onShowToast?.({
        title: "Adjustment exceeds remaining allocation",
        description: `${unit} only has ₱${Number(unitBudgets[unit] || 0).toLocaleString()} remaining.`,
        type: "error",
      });
      return;
    }

    try {
      await insertBudgetTransaction({
        amount: amount,
        type: unitBudgetAdjustmentType,
        description:
          unitBudgetDesc ||
          (unitBudgetAdjustmentType === "ADDED"
            ? `Additional allocation for ${unit}`
            : `Allocation reduction for ${unit}`),
        unit: normalizeUnitCode(unit),
      });
      await loadBudgetData();
      closeUnitAllocationModal();
      onShowToast({
        title: "Allocation updated",
        description: `${unit} allocation was ${unitBudgetAdjustmentType === "ADDED" ? "increased" : "reduced"} by ₱${amount.toLocaleString()}.`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to update unit allocation:", err);
      onShowToast({
        title: "Could not update allocation",
        description: err.message || "Please try again.",
        type: "error",
      });
    }
  };

      useEffect(() => {
        loadBudgetData();
      }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Admin Review
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review submitted AWPB entries and update their status.
        </p>
      </div>
      
      <Card className="border-0 bg-gradient-to-br from-[#6ea3a6] via-[#4f8f93] to-[#2f7f86] text-white shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
        <CardContent className="p-4 md:p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <p className="text-base font-semibold text-white">
                Allocation Summary
              </p>
              <p className="mt-1 max-w-2xl text-sm text-white/85">
                Unit allocations set approval limits. Approved entries reduce remaining balances.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="min-w-[150px] rounded-2xl bg-white/14 px-4 py-2.5">
                  <p className="text-xs font-medium text-white/70">Allocated</p>
                  <p className="text-base font-bold text-white">
                    ₱{totalAllocatedBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="min-w-[150px] rounded-2xl bg-white/14 px-4 py-2.5">
                  <p className="text-xs font-medium text-white/70">Approved</p>
                  <p className="text-base font-bold text-white">
                    ₱{totalApprovedBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="min-w-[150px] rounded-2xl bg-white/22 px-4 py-2.5">
                  <p className="text-xs font-medium text-white/75">Remaining</p>
                  <p className="text-base font-bold text-white">
                    ₱{totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setShowHistoryModal(true)}
                variant="outline"
                className="w-fit rounded-xl border-white/35 bg-white/10 text-white shadow-sm hover:bg-white/20 hover:text-white"
              >
                <History className="mr-2 h-4 w-4" />
                View Records
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

{showHistoryModal && (
  <AdminBudgetRecordsModal
    approvedEntries={approvedEntries}
    onClose={() => setShowHistoryModal(false)}
    transactions={transactions}
  />
)}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {UNITS.map((unit) => {
          const stats = unitAllocationStats[unit] || {};
          return (
            <Card
              key={unit}
              className="overflow-hidden border-0 bg-gradient-to-br from-[#1f2f74] via-[#243b86] to-[#2a4694] text-white shadow-[0_10px_22px_rgba(31,47,116,0.18)]"
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        Unit Allocation
                      </p>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight">{unit}</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white/70">Remaining</p>
                      <p className="text-2xl font-bold leading-tight">
                        ₱{Number(stats.remaining || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/15 pt-3">
                    <p className="text-xs text-white/55">Allocated</p>
                    <p className="text-xs text-white/55">Approved</p>
                    <p className="text-sm font-semibold">
                      ₱{Number(stats.allocated || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm font-semibold">
                      ₱{Number(stats.approved || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setActiveUnitBudgetModal(unit)}
                      className="flex-1 rounded-xl bg-white text-slate-900 hover:bg-slate-100"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit Allocation
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setActiveUnitHistoryModal(unit)}
                      variant="outline"
                      className="flex-1 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    >
                      <History className="mr-1.5 h-3.5 w-3.5" />
                      Records
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeUnitBudgetModal && (
        <AdminUnitAllocationModal
          adjustmentType={unitBudgetAdjustmentType}
          amount={unitBudgetAmount}
          description={unitBudgetDesc}
          onAmountChange={setUnitBudgetAmount}
          onClose={closeUnitAllocationModal}
          onDescriptionChange={setUnitBudgetDesc}
          onSave={handleSaveUnitAllocation}
          onTypeChange={setUnitBudgetAdjustmentType}
          remaining={unitAllocationStats[activeUnitBudgetModal]?.remaining || 0}
          unit={activeUnitBudgetModal}
        />
      )}

      {activeUnitHistoryModal && (
        <AdminUnitRecordsModal
          entries={approvedEntriesByUnit[activeUnitHistoryModal] || []}
          onClose={() => setActiveUnitHistoryModal(null)}
          totalApproved={unitAllocationStats[activeUnitHistoryModal]?.approved || 0}
          unit={activeUnitHistoryModal}
        />
      )}

      <Card className="overflow-hidden border-0 shadow-[0_10px_24px_rgba(15,23,42,0.08)] gap-0 py-0">
        <CardHeader className="border-b bg-white px-6 pt-5 pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-2xl">All Submitted Entries</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Search and filter submissions for admin review.
              </p>
              <p className="mt-6 text-sm text-slate-500">
                Showing {filteredEntries.length} of {entries.length} entries
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[280px_125px_115px_115px_auto_auto] xl:w-auto xl:justify-start">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search title, sub activity, or unit"
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending Review">Pending Review</SelectItem>
                  <SelectItem value="Returned">Returned</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {formatUnitCode(unit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={clearFilters} className={`whitespace-nowrap ${gradientButtonClass}`}>
                Reset
              </Button>
              <Button onClick={handleExportApprovedEntriesToCSV} className={`whitespace-nowrap ${gradientButtonClass}`}>
                Export to CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No entries match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[19%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[8%]" />
                  <col className="w-[15%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                </colgroup>

                <thead className="bg-slate-50 text-left">
                  <tr className="border-b">
                    <th className="px-4 py-2.5 font-semibold text-slate-700">Title</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">No.</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">Unit</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">Year</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">Submitted</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-700">Total</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-b-0">
                      <td className="px-4 py-4">
                        <p className="truncate font-medium text-slate-900" title={entry.titleOfActivities}>
                          {entry.titleOfActivities}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{entry.no || 'N/A'}</td>
                      <td className="px-4 py-4 font-medium text-slate-700" title={entry.unit}>
                        {formatUnitCode(entry.unit)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">{entry.planningYear || "N/A"}</td>
                      <td className="px-4 py-4 text-slate-700">{formatDate(entry.submittedAt)}</td>
                      <td className="px-4 py-4">
                        <Badge variant={getStatusBadgeVariant(entry.status)}>
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-900">
                        {formatCurrency(entry.grandTotal)}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSelectedEntry(entry)}
                            title="Review entry"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Eye />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(entry)}
                            title="Delete entry"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AdminEntryReviewModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onApprove={handleApprove}
        onReturn={handleReturn}
        onReject={handleReject}
        onGenerateApprovedEntry={handleGenerateApprovedEntry}
      />

      <AdminDeleteEntryModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        entry={deleteTarget}
        onConfirm={handleDelete}
        
      />
    </div>

  );
}
