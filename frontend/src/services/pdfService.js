import logoUrl from "../assets/logo.png";

const MONTH_ORDER = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0).replace(/^/, "PHP ");
}

function formatTarget(value) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPersonName(entry, prefix) {
  return (
    entry?.[`${prefix}DisplayName`] ||
    entry?.[`${prefix}FullName`] ||
    entry?.[`${prefix}Username`] ||
    "N/A"
  );
}

function getMonthlyRows(entry) {
  const rows = Array.isArray(entry?.monthlyBreakdown) ? entry.monthlyBreakdown : [];
  return rows
    .map((row) => {
      const target = Number(row.target || 0);
      return {
        month: row.month || "N/A",
        target,
        amount: Number(row.amount ?? target * Number(entry?.unitCost || 0)) || 0,
      };
    })
    .filter((row) => row.target > 0 || row.amount > 0)
    .sort((a, b) => {
      const aIndex = MONTH_ORDER.indexOf(String(a.month).toLowerCase());
      const bIndex = MONTH_ORDER.indexOf(String(b.month).toLowerCase());
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
}

function getReportTotals(entry, monthlyRows) {
  const totalTarget = monthlyRows.reduce((sum, row) => sum + Number(row.target || 0), 0);
  const monthlyTotal = monthlyRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const savedGrandTotal = Number(entry?.grandTotal || 0);

  return {
    totalTarget,
    totalAmount: monthlyTotal > 0 || savedGrandTotal === 0 ? monthlyTotal : savedGrandTotal,
  };
}

async function loadImageDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generateWithJsPdf(entry, controlNumber, filename) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const labelWidth = 44;
  const monthlyRows = getMonthlyRows(entry);
  const reportTotals = getReportTotals(entry, monthlyRows);
  let y = 16;

  const ensureSpace = (height) => {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawRow = (label, value, minHeight = 8) => {
    const textValue = value ?? "N/A";
    const wrapped = doc.splitTextToSize(String(textValue), contentWidth - labelWidth - 6);
    const rowHeight = Math.max(minHeight, wrapped.length * 4.8 + 4);
    ensureSpace(rowHeight);
    doc.setDrawColor(120, 120, 120);
    doc.rect(margin, y, contentWidth, rowHeight);
    doc.line(margin + labelWidth, y, margin + labelWidth, y + rowHeight);
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    doc.text(label, margin + 2, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.text(wrapped, margin + labelWidth + 2, y + 5.5);
    y += rowHeight;
  };

  const drawSectionTitle = (title) => {
    ensureSpace(12);
    y += 5;
    doc.setFont("helvetica", "bold").setFontSize(10.5);
    doc.text(title, margin, y);
    y += 5;
  };

  const drawMonthlyBreakdownTable = () => {
    drawSectionTitle("Monthly Breakdown");

    if (monthlyRows.length === 0) {
      drawRow("Monthly Breakdown", "No monthly breakdown found.");
      return;
    }

    const columns = [
      { label: "Month", width: 70, align: "left" },
      { label: "Target", width: 40, align: "right" },
      { label: "Amount", width: contentWidth - 110, align: "right" },
    ];
    const rowHeight = 8;

    const drawTableRow = (cells, isHeader = false) => {
      ensureSpace(rowHeight);
      doc.setFillColor(isHeader ? 243 : 255, isHeader ? 244 : 255, isHeader ? 246 : 255);
      doc.setDrawColor(120, 120, 120);
      doc.rect(margin, y, contentWidth, rowHeight, "FD");

      let x = margin;
      doc.setFont("helvetica", isHeader ? "bold" : "normal").setFontSize(9);
      cells.forEach((cell, index) => {
        const column = columns[index];
        const textX = column.align === "right" ? x + column.width - 2 : x + 2;
        doc.text(String(cell), textX, y + 5.2, {
          align: column.align,
          maxWidth: column.width - 4,
        });
        if (index < columns.length - 1) {
          doc.line(x + column.width, y, x + column.width, y + rowHeight);
        }
        x += column.width;
      });
      y += rowHeight;
    };

    drawTableRow(columns.map((column) => column.label), true);
    monthlyRows.forEach((row) => {
      drawTableRow([row.month, formatTarget(row.target), formatCurrency(row.amount)]);
    });
    drawTableRow(
      ["Total", formatTarget(reportTotals.totalTarget), formatCurrency(reportTotals.totalAmount)],
      true,
    );
  };

  const drawCertification = () => {
    ensureSpace(42);
    y += 7;
    doc.setFont("helvetica", "bold").setFontSize(10.5);
    doc.text("CERTIFICATION", margin, y);

    y += 11;
    doc.setFont("helvetica", "normal").setFontSize(9);
    const leftX = margin;
    const rightX = margin + contentWidth / 2 + 6;

    doc.text("Prepared by:", leftX, y);
    doc.line(leftX + 28, y + 3, leftX + 78, y + 3);
    doc.text("Reviewed by:", rightX, y);
    doc.line(rightX + 28, y + 3, rightX + 78, y + 3);

    y += 16;
    doc.text("Approved by:", leftX, y);
    doc.line(leftX + 28, y + 3, leftX + 78, y + 3);
    doc.text("Date:", rightX, y);
    doc.line(rightX + 14, y + 3, rightX + 78, y + 3);

    y += 8;
  };

  try {
    const logoDataUrl = await loadImageDataUrl(logoUrl);
    doc.addImage(logoDataUrl, "PNG", margin + 2, y + 2, 46, 17);
  } catch {
    // Ignore logo issue in fallback mode.
  }

  const headerCenterX = margin + ((contentWidth + 46) / 2);
  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text("DEPARTMENT OF TRADE AND INDUSTRY", headerCenterX, y + 7, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text("RAPID Growth Project - Region X", headerCenterX, y + 7, { align: "center" });
  y += 11;
  doc.setFontSize(13);
  doc.text("ANNUAL WORK PLAN AND BUDGET (AWPB)", headerCenterX, y + 7, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text("APPROVED ENTRY REPORT", headerCenterX, y + 7, { align: "center" });
  y += 16;

  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`Control Number: ${controlNumber}`, margin + 2, y);
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth - margin - 2, y, { align: "right" });
  y += 4;

  drawRow("Entry ID", String(entry.id || "N/A"));
  drawRow("Planning Year", String(entry.planningYear || "N/A"));
  drawRow("Unit", entry.unit || "N/A");
  drawRow("Status", entry.status || "Approved");
  drawRow("Title of Activities", entry.titleOfActivities || "N/A", 12);
  drawRow("Component", entry.component || "N/A");
  drawRow("Sub Component", entry.subComponent || "N/A");
  drawRow("Key Activity", entry.keyActivity || "N/A", 10);
  drawRow("Activity No.", entry.no || "N/A");
  drawRow("Performance Indicator", entry.performanceIndicator || "N/A", 12);
  drawRow("Sub Activity", entry.subActivity || "N/A");
  drawRow("Unit Cost", formatCurrency(entry.unitCost));
  drawRow("Total Target", formatTarget(reportTotals.totalTarget));
  drawRow("Grand Total", formatCurrency(reportTotals.totalAmount));
  drawRow("Submitted By", getPersonName(entry, "owner"));
  drawRow("Reviewed By", getPersonName(entry, "reviewer"));
  drawRow("Submitted At", formatDate(entry.submittedAt));
  drawRow("Reviewed At", formatDate(entry.reviewedAt));
  drawRow("Admin Comment", entry.adminComment || "-", 12);
  drawMonthlyBreakdownTable();
  drawCertification();

  doc.save(filename);
}

export async function generateApprovedEntryPdf(entry) {
  const controlNumber = `DTI-AWPB-${new Date().getFullYear()}-${String(entry.id).slice(0, 8)}`;
  const filename = `AWPB_${controlNumber}.pdf`;
  await generateWithJsPdf(entry, controlNumber, filename);

  return { filename, controlNumber };
}
