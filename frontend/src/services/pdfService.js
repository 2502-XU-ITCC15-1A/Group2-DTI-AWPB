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

async function generateWithJsPdfFallback(entry, controlNumber, filename) {
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

  doc.save(filename);
}

export async function generateApprovedEntryPdf(entry) {
  const controlNumber = `DTI-AWPB-${new Date().getFullYear()}-${String(entry.id).slice(0, 8)}`;
  const filename = `AWPB_${controlNumber}.pdf`;
  try {
    const [{ default: PDFDocument }, { default: blobStream }] = await Promise.all([
      import("pdfkit/js/pdfkit.standalone.js"),
      import("blob-stream"),
    ]);

    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const stream = doc.pipe(blobStream());

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const labelWidth = 125;
    const logoX = margin + 6;
    const logoY = 48;
    const logoWidth = 130;
    const logoHeight = 50;
    const monthlyRows = getMonthlyRows(entry);
    const reportTotals = getReportTotals(entry, monthlyRows);
    let y = 42;
    const headerTextCenterX = margin + (contentWidth + logoWidth) / 2;

    const ensureSpace = (height) => {
      if (y + height > pageHeight - 78) {
        doc.addPage();
        y = 46;
      }
    };

    const drawRow = (label, value, minHeight = 24) => {
      const textValue = value ?? "N/A";
      const valueWidth = contentWidth - labelWidth - 12;
      const valueHeight = doc
        .font("Helvetica")
        .fontSize(10)
        .heightOfString(String(textValue), { width: valueWidth });
      const rowHeight = Math.max(minHeight, valueHeight + 10);

      ensureSpace(rowHeight);

      doc.lineWidth(0.7).strokeColor("#777");
      doc.rect(margin, y, contentWidth, rowHeight).stroke();
      doc.moveTo(margin + labelWidth, y).lineTo(margin + labelWidth, y + rowHeight).stroke();

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#000");
      doc.text(label, margin + 6, y + 7, { width: labelWidth - 10 });

      doc.font("Helvetica").fontSize(10);
      doc.text(String(textValue), margin + labelWidth + 6, y + 7, { width: valueWidth });

      y += rowHeight;
    };

    const drawSectionTitle = (title) => {
      ensureSpace(28);
      y += 12;
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#000");
      doc.text(title, margin + 6, y);
      y += 18;
    };

    const drawMonthlyBreakdownTable = () => {
      drawSectionTitle("MONTHLY BREAKDOWN");

      if (monthlyRows.length === 0) {
        drawRow("Monthly Breakdown", "No monthly breakdown found.");
        return;
      }

      const columns = [
        { label: "Month", width: 220, align: "left" },
        { label: "Target", width: 105, align: "right" },
        { label: "Amount", width: contentWidth - 325, align: "right" },
      ];
      const rowHeight = 24;

      const drawTableRow = (cells, isHeader = false) => {
        ensureSpace(rowHeight);
        doc
          .lineWidth(0.7)
          .strokeColor("#777")
          .rect(margin, y, contentWidth, rowHeight)
          .fillAndStroke(isHeader ? "#f3f4f6" : "#ffffff", "#777");

        let x = margin;
        doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#000");

        cells.forEach((cell, index) => {
          const column = columns[index];
          doc.text(String(cell), x + 6, y + 7, {
            width: column.width - 12,
            align: column.align,
          });

          if (index < columns.length - 1) {
            doc.moveTo(x + column.width, y).lineTo(x + column.width, y + rowHeight).stroke();
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
      ensureSpace(96);
      y += 12;
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#000");
      doc.text("CERTIFICATION", margin + 6, y);

      y += 20;
      doc.font("Helvetica").fontSize(10);
      doc.text("Prepared by:", margin + 6, y);
      doc.moveTo(margin + 72, y + 10).lineTo(margin + 230, y + 10).stroke();
      doc.text("Reviewed by:", margin + 265, y);
      doc.moveTo(margin + 332, y + 10).lineTo(margin + 500, y + 10).stroke();

      y += 34;
      doc.text("Approved by:", margin + 6, y);
      doc.moveTo(margin + 72, y + 10).lineTo(margin + 230, y + 10).stroke();
      doc.text("Date:", margin + 265, y);
      doc.moveTo(margin + 298, y + 10).lineTo(margin + 500, y + 10).stroke();
    };

    doc.lineWidth(1).strokeColor("#555");
    doc.rect(margin, y, contentWidth, pageHeight - margin - y).stroke();

    try {
      const logoDataUrl = await loadImageDataUrl(logoUrl);
      doc.image(logoDataUrl, logoX, logoY, { width: logoWidth, height: logoHeight });
    } catch {
      // Continue even if logo load fails.
    }

    doc.fillColor("#000").font("Helvetica-Bold").fontSize(17);
    doc.text("DEPARTMENT OF TRADE AND INDUSTRY", headerTextCenterX, y + 18, {
      align: "center",
      width: 250,
    });
    doc.fontSize(12);
    doc.text("RAPID Growth Project - Region X", headerTextCenterX, y + 42, {
      align: "center",
      width: 250,
    });
    doc.fontSize(14);
    doc.text("ANNUAL WORK PLAN AND BUDGET (AWPB)", headerTextCenterX, y + 68, {
      align: "center",
      width: 250,
    });
    doc.fontSize(12);
    doc.text("APPROVED ENTRY REPORT", headerTextCenterX, y + 88, {
      align: "center",
      width: 250,
    });

    y = 124;
    y = Math.max(y, logoY + logoHeight + 18);
    doc.font("Helvetica").fontSize(9.5);
    doc.text(`Control Number: ${controlNumber}`, margin + 6, y);
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth - margin - 6, y, {
      align: "right",
      width: 250,
    });

    y += 12;
    drawRow("Entry ID", String(entry.id || "N/A"));
    drawRow("Planning Year", String(entry.planningYear || "N/A"));
    drawRow("Unit", entry.unit || "N/A");
    drawRow("Status", entry.status || "Approved");
    drawRow("Title of Activities", entry.titleOfActivities || "N/A", 34);
    drawRow("Component", entry.component || "N/A");
    drawRow("Sub Component", entry.subComponent || "N/A");
    drawRow("Key Activity", entry.keyActivity || "N/A", 30);
    drawRow("Activity No.", entry.no || "N/A");
    drawRow("Performance Indicator", entry.performanceIndicator || "N/A", 34);
    drawRow("Sub Activity", entry.subActivity || "N/A");
    drawRow("Unit Cost", formatCurrency(entry.unitCost));
    drawRow("Total Target", formatTarget(reportTotals.totalTarget));
    drawRow("Grand Total", formatCurrency(reportTotals.totalAmount));
    drawRow("Submitted By", getPersonName(entry, "owner"));
    drawRow("Reviewed By", getPersonName(entry, "reviewer"));
    drawRow("Submitted At", formatDate(entry.submittedAt));
    drawRow("Reviewed At", formatDate(entry.reviewedAt));
    drawRow("Admin Comment", entry.adminComment || "-", 34);

    drawMonthlyBreakdownTable();
    drawCertification();

    doc.end();

    await new Promise((resolve) => {
      stream.on("finish", resolve);
    });

    const blobUrl = stream.toBlobURL("application/pdf");
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.warn("PDFKit export failed, using jsPDF fallback:", error);
    await generateWithJsPdfFallback(entry, controlNumber, filename);
  }

  return { filename, controlNumber };
}
