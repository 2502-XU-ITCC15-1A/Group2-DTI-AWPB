function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatDate(value) {
  if (!value) return "N/A"

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getStatusClasses(status) {
  switch (status) {
    case "Pending Review":
      return "bg-yellow-100 text-yellow-700"
    case "Returned":
      return "bg-red-100 text-red-700"
    case "Rejected":
      return "bg-gray-200 text-gray-700"
    case "Approved":
      return "bg-green-100 text-green-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

function getPersonName(entry, prefix) {
  return (
    entry?.[`${prefix}DisplayName`] ||
    entry?.[`${prefix}FullName`] ||
    entry?.[`${prefix}Username`] ||
    "N/A"
  )
}

export default function EntryDetailsModal({ entry, onClose, onExportToPdf }) {
  if (!entry) return null

  const isApprovedStatus =
    String(entry.status || "").trim().toLowerCase() === "approved"

  const activeMonthlyRows =
    entry.monthlyBreakdown?.filter((row) => row.target > 0) || []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">Entry Details</h2>
            <p className="text-sm text-gray-500">
              Review the full submitted entry information.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">{entry.titleOfActivities}</h3>
              <p className="text-sm text-gray-500">
                Submitted by {getPersonName(entry, "owner")} on {formatDate(entry.submittedAt)}
              </p>
              {entry.reviewedAt && (
                <p className="mt-1 text-sm text-gray-500">
                  Reviewed by {getPersonName(entry, "reviewer")} on {formatDate(entry.reviewedAt)}
                </p>
              )}
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${getStatusClasses(
                entry.status
              )}`}
            >
              {entry.status}
            </span>
          </div>

          {isApprovedStatus && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onExportToPdf?.(entry)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Export to PDF
              </button>
            </div>
          )}

          {(entry.status === "Returned" || entry.status === "Rejected") &&
            entry.adminComment && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h4 className="mb-2 font-medium text-amber-900">
                  Admin Comment
                </h4>
                <p className="text-sm text-amber-900">{entry.adminComment}</p>
              </div>
            )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-gray-50 p-4">
              <h4 className="mb-3 font-medium">Classification</h4>

              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Planning Year:</span> {entry.planningYear || "N/A"}</p>
                <p><span className="font-medium">Unit:</span> {entry.unit || "N/A"}</p>
                <p><span className="font-medium">Component:</span> {entry.component || "N/A"}</p>
                <p><span className="font-medium">Sub component:</span> {entry.subComponent || "N/A"}</p>
                <p><span className="font-medium">Key Activity:</span> {entry.keyActivity || "N/A"}</p>
                <p><span className="font-medium">No.:</span> {entry.no || "N/A"}</p>
                <p><span className="font-medium">Performance Indicator:</span> {entry.performanceIndicator || "N/A"}</p>
                <p><span className="font-medium">Sub Activity:</span> {entry.subActivity || "N/A"}</p>
              </div>
            </div>

            <div className="rounded-xl border bg-gray-50 p-4">
              <h4 className="mb-3 font-medium">Budget Summary</h4>

              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Unit Cost:</span> {formatCurrency(entry.unitCost)}</p>
                <p>
                  <span className="font-medium">Active Months:</span>{" "}
                  {activeMonthlyRows.length > 0
                    ? activeMonthlyRows.map((row) => row.month).join(", ")
                    : "None"}
                </p>
                <p><span className="font-medium">Grand Total:</span> {formatCurrency(entry.grandTotal)}</p>
                <p><span className="font-medium">Submitted By:</span> {getPersonName(entry, "owner")}</p>
                <p><span className="font-medium">Reviewed By:</span> {entry.reviewedAt ? getPersonName(entry, "reviewer") : "N/A"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h4 className="mb-3 font-medium">Title of Activities</h4>
            <p className="text-sm text-gray-700">
              {entry.titleOfActivities || "N/A"}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h4 className="mb-3 font-medium">Monthly Breakdown</h4>

            {entry.monthlyBreakdown?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Month</th>
                      <th className="px-3 py-2 text-left">Target</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.monthlyBreakdown.map((row, index) => (
                      <tr
                        key={row.month}
                        className={index !== 0 ? "border-t" : ""}
                      >
                        <td className="px-3 py-2">{row.month}</td>
                        <td className="px-3 py-2">{row.target}</td>
                        <td className="px-3 py-2">
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-gray-50">
                    <tr>
                      <td className="px-3 py-2 font-semibold" colSpan={2}>
                        Grand Total
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {formatCurrency(entry.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No monthly breakdown found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
