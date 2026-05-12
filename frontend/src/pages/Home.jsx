import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatDateTime(value) {
  if (!value) return "N/A";

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "N/A";

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
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

function isSubmissionWindowOpen(submissionWindow) {
  const { startDate, endDate } = submissionWindow || {};

  if (!startDate || !endDate) return false;

  const today = new Date();
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  return today >= start && today <= end;
}

function StatCard({ title, value, icon, highlight = false }) {
  const IconComponent = icon;

  return (
    <Card
      className={
        highlight
          ? "border-0 bg-gradient-to-br from-[#1f2f74] via-[#243b86] to-[#2a4694] text-white shadow-md"
          : "border-0 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
      }
    >
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p
            className={`text-sm ${highlight ? "text-white/75" : "text-slate-500"
              }`}
          >
            {title}
          </p>
          <h2 className="mt-3 text-4xl font-bold">{value}</h2>
        </div>

        <div
          className={`rounded-2xl p-3 ${highlight ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}
        >
          <IconComponent size={20} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home({ entries = [], submissionWindow }) {
  const windowOpen = isSubmissionWindowOpen(submissionWindow);

  const stats = useMemo(() => {
    return {
      pending: entries.filter((entry) => entry.status === "Pending Review")
        .length,
      returned: entries.filter((entry) => entry.status === "Returned").length,
      rejected: entries.filter((entry) => entry.status === "Rejected").length,
      approved: entries.filter((entry) => entry.status === "Approved").length,
    };
  }, [entries]);

  const returnedEntries = useMemo(() => {
    return entries.filter((entry) => entry.status === "Returned").slice(0, 5);
  }, [entries]);

  const returnedEntryCount = useMemo(() => {
    return entries.filter((entry) => entry.status === "Returned").length;
  }, [entries]);

  const recentEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 5);
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Home
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View your submission statuses and recent AWPB entries.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            asChild
            variant="outline"
            className="border border-slate-200 bg-white text-slate-700 shadow-[0_3px_10px_rgba(15,23,42,0.08)] transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 hover:shadow-[0_6px_16px_rgba(15,23,42,0.10)]"
          >
            <Link to="/entries">Go to My Entries</Link>
          </Button>

          <Button
            asChild
            className="border-0 bg-gradient-to-r from-[#1f2f74] to-[#2a4694] text-white shadow-[0_6px_16px_rgba(31,47,116,0.28)] transition-all duration-200 hover:from-[#19265f] hover:to-[#213a80] hover:shadow-[0_10px_24px_rgba(31,47,116,0.38)]"
          >
            <Link to="/submit">Add New Entry</Link>
          </Button>

        </div>
      </div>

      <Card
        className={`border-0 shadow-[0_12px_28px_rgba(15,23,42,0.12)] ${windowOpen
            ? "border-0 bg-gradient-to-br from-[#6ea3a6] via-[#4f8f93] to-[#2f7f86]"
            : "border-0 bg-gradient-to-br from-[#f9d1d1] via-[#f5bcbc] to-[#ef9f9f]"
          }`}
      >
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <p
                className={`text-base font-semibold ${windowOpen ? "text-white" : "text-rose-900"}`}
              >
                Encoding Period {windowOpen ? "Open" : "Closed"}
              </p>

              <p
                className={`text-sm ${windowOpen ? "text-white/90" : "text-rose-800"}`}
              >
                {formatDateOnly(submissionWindow?.startDate)} to{" "}
                {formatDateOnly(submissionWindow?.endDate)}
              </p>
            </div>

            <Badge
              variant="outline"
              className={
                windowOpen
                  ? "border-white/40 bg-white/20 text-white"
                  : "border-rose-300 bg-white/40 text-rose-800"
              }
            >
              {windowOpen ? "Open" : "Closed"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle2}
          highlight
        />
        <StatCard title="Pending" value={stats.pending} icon={Clock3} />
        <StatCard title="Rejected" value={stats.rejected} icon={XCircle} />
        <StatCard title="Revision" value={stats.returned} icon={AlertCircle} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="border-0 shadow-[0_10px_24px_rgba(15,23,42,0.08)] xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Needs Attention</CardTitle>
            <p className="text-sm text-slate-500">
              Returned entries that may need revision.
            </p>
          </CardHeader>

          <CardContent>
            {returnedEntries.length === 0 ? (
              <div className="rounded-2xl border border border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No returned entries right now.
              </div>
            ) : (
              <div className="space-y-3">
                {returnedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50 p-4 shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {entry.titleOfActivities}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.unit} • {entry.planningYear || "N/A"}
                      </p>
                    </div>

                    <Badge variant={getStatusBadgeVariant(entry.status)}>
                      {entry.status}
                    </Badge>
                  </div>
                ))}
                {returnedEntryCount >= 5 && (
                  <Button
                    asChild
                    variant="link"
                    className="h-auto px-0 text-[#1f2f74] hover:text-[#2a4694]"
                  >
                    <Link to="/submit">See more in Submit Entry</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="h-full">
          <Card className="h-full border-0 shadow-[0_10px_24px_rgba(15,23,42,0.08)] flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Recent Submissions</CardTitle>
              <p className="text-sm text-slate-500">
                Your latest submitted entries.
              </p>
            </CardHeader>

            <CardContent className="flex-1">
              {recentEntries.length === 0 ? (
                <div className="rounded-2xl border border border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  <p className="text-sm text-slate-500">
                    No entries submitted yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50 p-4 shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {entry.titleOfActivities}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Submitted {formatDateTime(entry.submittedAt)}
                        </p>
                      </div>

                      <Badge variant={getStatusBadgeVariant(entry.status)}>
                        {entry.status}
                      </Badge>
                    </div>
                  ))}
                  {entries.length >= 5 && (
                    <Button
                      asChild
                      variant="link"
                      className="h-auto px-0 text-[#1f2f74] hover:text-[#2a4694]"
                    >
                      <Link to="/entries">See more in My Entries</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
