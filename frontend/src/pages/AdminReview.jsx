import { useEffect, useMemo, useState } from "react";
import { Search, Eye, Trash2, History, X, Wallet } from "lucide-react";
import { generateApprovedEntryPdf } from "../services/pdfService";
import { csvExportService } from "../services/csvService";

import AdminEntryReviewModal from "../components/admin/AdminEntryReviewModal";
import AdminDeleteEntryModal from "../components/admin/AdminDeleteEntryModal";

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
  });
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

export default function AdminReview({
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
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetDesc, setBudgetDesc] = useState("");

  const entries = entriesProp;

  const availableUnits = useMemo(() => {
    return [...new Set(entries.map((entry) => entry.unit).filter(Boolean))].sort();
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
        entry.unit?.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || entry.status === statusFilter;

      const matchesUnit = unitFilter === "all" || entry.unit === unitFilter;

      const matchesYear =
        yearFilter === "all" || String(entry.planningYear) === yearFilter;

      return matchesSearch && matchesStatus && matchesUnit && matchesYear;
    });
  }, [entries, searchTerm, statusFilter, unitFilter, yearFilter]);

  const persistEntryUpdate = async (entryId, uiUpdates, successToast) => {
    const dbUpdates = {
      status: uiUpdates.status,
      reviewer_notes: uiUpdates.adminComment ?? "",
      review_date: uiUpdates.reviewedAt,
    };

    try {
      await entriesService.update(entryId, dbUpdates);
      onUpdateEntry?.(entryId, uiUpdates);
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

  const handleApprove = async (note) => {
  if (!selectedEntry) return;
  const entryAmount = selectedEntry.grandTotal || 0;
  const entryTitle = selectedEntry.titleOfActivities;

  if (entryAmount > totalBudget) {
    onShowToast?.({
      title: "Insufficient budget",
      description: `Need ₱${entryAmount.toLocaleString()} but only ₱${totalBudget.toLocaleString()} available. Please add budget first.`,
      type: "error",
    });
    return;
  }
  
  try {
    const { error: txError } = await supabase.from("budget_transactions").insert({
      amount: entryAmount,
      type: 'DEDUCTED',
      description: `Approved: ${entryTitle}`,
    });

    if (txError) throw txError;
    
    await persistEntryUpdate(
      selectedEntry.id,
      {
        status: "Approved",
        adminComment: note || "",
        reviewedAt: new Date().toISOString(),
      },
      {
        title: "Entry approved",
        description: `${entryTitle} was approved successfully. ₱${entryAmount.toLocaleString()} deducted from budget.`,
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
  
const reverseBudgetDeduction = async (entryId, entryTitle, amount, oldStatus, newStatus) => {
  try {
    const { error } = await supabase.from("budget_transactions").insert({
      amount: amount,
      type: 'ADDED',
      description: `REVERSAL: "${entryTitle}" changed from ${oldStatus} → ${newStatus}`,
    });
    
    if (error) throw error;
    
    onShowToast?.({
      title: "Budget restored",
      description: `₱${amount.toLocaleString()} was added back to budget for: ${entryTitle}`,
      type: "success",
    });
    
    return true;
  } catch (err) {
    console.error("Failed to reverse budget deduction:", err);
    onShowToast?.({
      title: "Could not restore budget",
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

  // Check if it was approved and reverse budget if needed
  if (isApprovedStatus(oldStatus)) {
    console.log(`Entry was ${oldStatus}, reversing budget deduction of ₱${entryAmount.toLocaleString()}`);
    const reversed = await reverseBudgetDeduction(selectedEntry.id, entryTitle, entryAmount, oldStatus, newStatus);
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
      description: `${entryTitle} was returned for revision.${isApprovedStatus(oldStatus) ? ` ₱${entryAmount.toLocaleString()} restored to budget.` : ""}`,
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
         console.log(`Entry was ${oldStatus}, reversing budget deduction of ₱${entryAmount.toLocaleString()}`);
    const reversed = await reverseBudgetDeduction(selectedEntry.id, entryTitle, entryAmount, oldStatus, newStatus);
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
        description: `${entryTitle} was rejected.${isApprovedStatus(oldStatus) ? ` ₱${entryAmount.toLocaleString()} restored to budget.` : ""}`,
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

    try {
      await entriesService.delete(deleteTarget.id);
      onDeleteEntry?.(deleteTarget.id);
      onShowToast?.({
        title: "Entry deleted",
        description: `${entryTitle} was removed successfully.`,
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
      const {data: txData, error: txError} = await supabase
        .from("budget_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (txError) throw txError;

        setTransactions(txData || []);
        
        //budget calculation 
        let total = 0;
        txData?.forEach((tx) => {
        if (tx.type === 'ADDED') {
          total += Number(tx.amount);
        } else if (tx.type === 'DEDUCTED') {
          total -= Number(tx.amount);
      }
    });  
    setTotalBudget(total);
    } catch (err) {
      console.error("Failed to load budget transactions:", err);
    }
  };
  // Add budget
  const handleAddBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (!amount|| amount <= 0) {
      onShowToast?.({
        title: "Invalid amount",
        description: "Please enter a valid budget amount.",
        type: "error",
      });
      return;
    }
    try {
      const { error } = await supabase.from("budget_transactions").insert({
        amount: amount,
        type: 'ADDED',
        description: budgetDesc || 'Budget addition',
      });

      if (error) throw error;
      await loadBudgetData();
      setShowBudgetModal(false);
      setBudgetAmount("");
      setBudgetDesc("");
      onShowToast({
        title: "Budget added",
        description: `₱${amount.toLocaleString()} added successfully.`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to add budget transaction:", err);
      onShowToast({
        title: "Could not add budget",
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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white/20 p-3 text-white">
          <Wallet size={20} />
        </div>

        <div className="space-y-1">
          <p className="text-base font-semibold text-white">Total Budget</p>
          <p className="text-3xl font-bold tracking-tight">
              ₱{totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-white/85">Available for approvals</p>
        </div>
      </div>

    </div>
  </CardContent>
</Card>

{/* Add Budget Modal */}
{showBudgetModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-2xl w-[450px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Add Budget</h3>
          <p className="text-emerald-100 text-sm mt-1">Increase available funds</p>
        </div>
        <button 
          onClick={() => setShowBudgetModal(false)}
          className="text-white hover:bg-white/20 rounded-lg p-1 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Body */}
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Amount (₱)</label>
          <Input 
            type="number" 
            placeholder="0.00" 
            value = {budgetAmount}
            onChange={(e) => setBudgetAmount(e.target.value)}
            className="text-lg font-medium"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Description (optional)</label>
          <Input 
            type="text" 
            placeholder="e.g., Budget realignment, Additional funds" 
            value={budgetDesc}
            onChange={(e) => setBudgetDesc(e.target.value)}
          />
        </div>
        
        <div className="flex gap-3 pt-4">
          <Button 
          onClick={handleAddBudget}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            Add Budget
          </Button>
          <Button 
            onClick={() => setShowBudgetModal(false)} 
            variant="outline" 
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  </div>
)}

{/* History Modal */}
{showHistoryModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Transaction History</h3>
          <p className="text-emerald-100 text-sm mt-1">All budget movements</p>
        </div>
        <button 
          onClick={() => setShowHistoryModal(false)}
          className="text-white hover:bg-white/20 rounded-lg p-1 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Balance Badge */}
      <div className="px-6 pt-4 pb-2 border-b">
        <div className="flex justify-end">
          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-base px-4 py-2">
            Current Balance: ₱{totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Badge>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="border-b">
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Date & Time</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Type</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Amount</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Description</th>
            </tr>
          </thead>
          <tbody>
           {transactions.length === 0 ? (
    <tr>
      <td colSpan="4" className="text-center py-12 text-slate-400">
        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No transactions yet</p>
        <p className="text-sm">Add budget to get started</p>
      </td>
    </tr>
  ) : (
    transactions.map((tx) => (
      <tr key={tx.id} className="border-b hover:bg-slate-50">
        <td className="px-6 py-3 text-slate-600">
          {new Date(tx.created_at).toLocaleString()}
        </td>
        <td className="px-6 py-3">
          <Badge className={tx.type === 'ADDED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
            {tx.type}
          </Badge>
        </td>
        <td className={`px-6 py-3 font-semibold ${tx.type === 'ADDED' ? 'text-green-600' : 'text-red-600'}`}>
          {tx.type === 'ADDED' ? '+' : '-'}₱{Number(tx.amount).toLocaleString()}
        </td>
        <td className="px-6 py-3 text-slate-600">{tx.description}</td>
      </tr>
    ))
  )}
          </tbody>
        </table>
        
        {/* Empty State */}
        {/* <div className="text-center py-12 text-slate-400">
          <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No transactions yet</p>
          <p className="text-sm">Add budget to get started</p>
        </div> */}
      </div>
      
      {/* Footer */}
      <div className="border-t p-4 bg-slate-50 rounded-b-xl">
        <Button 
          onClick={() => setShowHistoryModal(false)} 
          variant="outline" 
          className="w-full"
        >
          Close
        </Button>
      </div>
    </div>
  </div>
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

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
              <div className="relative w-full sm:min-w-[300px] sm:flex-1 xl:max-w-[340px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search title, sub activity, or unit"
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
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
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
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
              <Button onClick={handleExportApprovedEntriesToCSV}>
                Export to CSV
              </Button>
              <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto">
                Reset
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
                  <col className="w-[25%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
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
                      <td className="px-4 py-4 text-slate-700">{entry.unit}</td>
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
