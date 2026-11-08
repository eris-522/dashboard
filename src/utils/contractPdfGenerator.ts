import { jsPDF } from "jspdf";
import { CATERING_CONTRACT_TERMS } from "../data/cateringContractTerms";

export interface ContractPdfInput {
  bookingId: string | number;
  status: string;
  createdAt?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientUserId?: string;
  eventDate: string;
  serviceWindow: string;
  venueLocation: string;
  venueType?: string;
  packageName: string;
  baseGuests: number;
  extraGuests: number;
  totalGuests: number;
  selectedMenuItems: string[];
  financials: {
    basePrice: number;
    additionalPaxTotal: number;
    travelFee: number;
    haulingFee: number;
    corkageFee: number;
    prebookedOtFee: number;
    dayOfOtFee: number;
    rainLaundryFee: number;
    totalContractAmount: number;
    paymentScheme: string;
    downpaymentAmount: number;
    depositStatus: string;
    finalBalanceAmount: number;
    finalBalanceStatus: string;
    excessHeadcountFee?: number;
    damageFee?: number;
  };
  signature?: {
    signer_user_id?: string;
    signer_name?: string;
    signer_email?: string;
    signature_mode?: string;
    signature_data_url?: string;
    signed_at?: string;
  } | null;
  termsAccepted: boolean;
}

const formatPhp = (amount: number): string =>
  `PHP ${Math.round(Number(amount) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Generates a fallback stylized signature PNG on an offscreen canvas
 * when a legacy booking accepted terms via checkbox prior to canvas capture.
 */
function renderStylizedSignatureDataUrl(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 520;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#162447";
    ctx.font = "italic 44px Georgia, 'Times New Roman', serif";
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim() || "Verified Client", 24, 72);

    // Subtle flourish underline
    ctx.strokeStyle = "rgba(22, 36, 71, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 102);
    ctx.quadraticCurveTo(180, 92, 340, 104);
    ctx.stroke();

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Generates and downloads an official, multi-page Signed Catering Service Contract PDF
 * combining event details, itemized financials, all 20 clauses, and the client's signature.
 */
export async function downloadSignedContractPdf(data: ContractPdfInput): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 20;

  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      y = 20;
    }
  };

  // =========================================================================
  // 1. OFFICIAL LETTERHEAD
  // =========================================================================
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setFillColor(197, 160, 89); // Gold accent bar
  doc.rect(0, 34, pageWidth, 1.6, "F");

  doc.setTextColor(197, 160, 89);
  doc.setFont("times", "bold");
  doc.setFontSize(17);
  doc.text("ROXAN POLICARPIO EVENTS & CATERING", marginX, 15);

  doc.setTextColor(235, 235, 235);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "OFFICIAL CATERING SERVICE AGREEMENT & 20-POINT EXECUTED CONTRACT",
    marginX,
    21.5
  );

  const shortRef = String(data.bookingId || "N/A").split("-")[0].toUpperCase();
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  doc.text(`Contract Ref: #${shortRef}`, pageWidth - marginX, 14, { align: "right" });
  doc.text(`Booking Status: ${data.status.toUpperCase()}`, pageWidth - marginX, 19.5, {
    align: "right",
  });

  const signedIso = data.signature?.signed_at || data.createdAt || new Date().toISOString();
  const signedDateLabel = (() => {
    const d = new Date(signedIso);
    return isNaN(d.getTime())
      ? signedIso
      : d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  })();
  doc.text(`Executed: ${signedDateLabel}`, pageWidth - marginX, 25, { align: "right" });

  y = 43;

  // =========================================================================
  // 2. CONTRACTING PARTIES & EVENT SPECIFICATION
  // =========================================================================
  const signerName =
    data.signature?.signer_name?.trim() || data.clientName || "Authorized Client";
  const signerEmail = data.signature?.signer_email || data.clientEmail || "N/A";
  const signerUserId = data.signature?.signer_user_id || data.clientUserId || "Verified Account";

  doc.setFillColor(248, 246, 241);
  doc.setDrawColor(218, 208, 190);
  doc.roundedRect(marginX, y, contentWidth, 44, 2, 2, "FD");

  doc.setTextColor(145, 110, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("SECTION I — CONTRACTING CLIENT & EVENT SPECIFICATION", marginX + 4, y + 6);

  doc.setDrawColor(228, 220, 205);
  doc.line(marginX + 4, y + 8.5, pageWidth - marginX - 4, y + 8.5);

  const col1X = marginX + 4;
  const col2X = marginX + contentWidth / 2 + 2;

  const drawKeyVal = (
    xPos: number,
    yPos: number,
    label: string,
    val: string,
    maxValWidth: number
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(95, 95, 95);
    doc.text(label, xPos, yPos);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(25, 25, 25);
    const truncated = doc.splitTextToSize(val || "N/A", maxValWidth)[0] || "N/A";
    doc.text(truncated, xPos + 29, yPos);
  };

  drawKeyVal(col1X, y + 14, "Contract Signer:", signerName, 56);
  drawKeyVal(col1X, y + 20, "Client Email:", signerEmail, 56);
  drawKeyVal(col1X, y + 26, "Contact Phone:", data.clientPhone || "N/A", 56);
  drawKeyVal(col1X, y + 32, "Selected Package:", data.packageName, 56);
  drawKeyVal(
    col1X,
    y + 38,
    "Guaranteed Pax:",
    `${data.totalGuests} Guests (${data.baseGuests} base${
      data.extraGuests > 0 ? ` + ${data.extraGuests} extra` : ""
    })`,
    56
  );

  drawKeyVal(col2X, y + 14, "Event Date:", data.eventDate, 56);
  drawKeyVal(col2X, y + 20, "Service Window:", data.serviceWindow, 56);
  drawKeyVal(
    col2X,
    y + 26,
    "Venue Setting:",
    data.venueType || "Standard Venue",
    56
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(95, 95, 95);
  doc.text("Venue Address:", col2X, y + 32);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(25, 25, 25);
  const venueLines = doc.splitTextToSize(data.venueLocation || "N/A", 56).slice(0, 2);
  doc.text(venueLines, col2X + 29, y + 32);

  y += 50;

  // =========================================================================
  // 3. SELECTED MENU INCLUSIONS
  // =========================================================================
  if (data.selectedMenuItems && data.selectedMenuItems.length > 0) {
    const menuStr = data.selectedMenuItems.join("  •  ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const menuLines = doc.splitTextToSize(menuStr, contentWidth - 8);
    const boxH = Math.max(16, 10 + menuLines.length * 4);
    ensureSpace(boxH + 4);

    doc.setFillColor(252, 251, 249);
    doc.setDrawColor(225, 220, 210);
    doc.roundedRect(marginX, y, contentWidth, boxH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(145, 110, 45);
    doc.text(
      `SELECTED MENU ITEMS (${data.selectedMenuItems.length} DISHES)`,
      marginX + 4,
      y + 5.5
    );

    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(menuLines, marginX + 4, y + 10.5);

    y += boxH + 5;
  }

  // =========================================================================
  // 4. FINANCIAL & PAYMENT SCHEDULE
  // =========================================================================
  const f = data.financials;
  const lineItems: { label: string; value: string }[] = [
    { label: `Base Package (${data.baseGuests} Pax)`, value: formatPhp(f.basePrice) },
  ];
  if (f.additionalPaxTotal > 0) {
    lineItems.push({
      label: `Additional Guests (+${data.extraGuests} Pax)`,
      value: `+ ${formatPhp(f.additionalPaxTotal)}`,
    });
  }
  if (f.travelFee > 0) {
    lineItems.push({ label: "Out-of-Town Travel Fee", value: `+ ${formatPhp(f.travelFee)}` });
  }
  if (f.haulingFee > 0) {
    lineItems.push({
      label: "Hauling / Stairs Ingress Fee",
      value: `+ ${formatPhp(f.haulingFee)}`,
    });
  }
  if (f.corkageFee > 0) {
    lineItems.push({
      label: "Corkage & Additional Setup Fees (Clause 8)",
      value: `+ ${formatPhp(f.corkageFee)}`,
    });
  }
  if (f.prebookedOtFee > 0) {
    lineItems.push({
      label: "Pre-Booked Service Overtime (Clause 14)",
      value: `+ ${formatPhp(f.prebookedOtFee)}`,
    });
  }
  if (f.dayOfOtFee > 0) {
    lineItems.push({
      label: "Day-of Event Overtime Surcharge (Clause 14)",
      value: `+ ${formatPhp(f.dayOfOtFee)}`,
    });
  }
  if (f.rainLaundryFee > 0) {
    lineItems.push({
      label: "Outdoor Rain / Laundry Surcharge (Clause 17)",
      value: `+ ${formatPhp(f.rainLaundryFee)}`,
    });
  }

  const finHeight = 26 + lineItems.length * 5.2 + ((f.excessHeadcountFee || 0) > 0 || (f.damageFee || 0) > 0 ? 12 : 0);
  ensureSpace(finHeight + 6);

  doc.setFillColor(248, 246, 241);
  doc.setDrawColor(218, 208, 190);
  doc.roundedRect(marginX, y, contentWidth, finHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(145, 110, 45);
  doc.text("SECTION II — CONTRACT FINANCIAL SUMMARY & PAYMENT TERMS", marginX + 4, y + 6);

  let rowY = y + 12;
  doc.setFontSize(8);
  lineItems.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(item.label, marginX + 4, rowY);
    doc.setFont("helvetica", "bold");
    doc.text(item.value, pageWidth - marginX - 4, rowY, { align: "right" });
    rowY += 5;
  });

  doc.setDrawColor(210, 200, 180);
  doc.line(marginX + 4, rowY - 2, pageWidth - marginX - 4, rowY - 2);
  rowY += 2.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text("TOTAL CONTRACT AMOUNT:", marginX + 4, rowY);
  doc.text(formatPhp(f.totalContractAmount), pageWidth - marginX - 4, rowY, { align: "right" });

  rowY += 5.5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70, 70, 70);
  doc.text(
    `Date-Lock Deposit (${f.paymentScheme} — ${f.depositStatus})`,
    marginX + 4,
    rowY
  );
  doc.text(formatPhp(f.downpaymentAmount), pageWidth - marginX - 4, rowY, { align: "right" });

  rowY += 4.8;
  doc.text(
    `15-Day Pre-Event Remaining Balance (${f.finalBalanceStatus})`,
    marginX + 4,
    rowY
  );
  doc.text(formatPhp(f.finalBalanceAmount), pageWidth - marginX - 4, rowY, { align: "right" });

  if ((f.excessHeadcountFee || 0) > 0 || (f.damageFee || 0) > 0) {
    rowY += 5.5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 50, 50);
    const postParts: string[] = [];
    if ((f.excessHeadcountFee || 0) > 0) {
      postParts.push(`Excess Headcount Surcharge (Clause 11): ${formatPhp(f.excessHeadcountFee || 0)}`);
    }
    if ((f.damageFee || 0) > 0) {
      postParts.push(`Equipment Damage Appraisal (Clause 13): ${formatPhp(f.damageFee || 0)}`);
    }
    doc.text(
      `Separate Post-Event Assessments: ${postParts.join("  |  ")}`,
      marginX + 4,
      rowY
    );
  }

  y += finHeight + 8;

  // =========================================================================
  // 5. ALL 20 CONTRACTUAL CLAUSES
  // =========================================================================
  ensureSpace(16);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("SECTION III — COMPLETE TERMS & CONDITIONS (CLAUSES 1 TO 20)", marginX, y);
  y += 2.5;
  doc.setDrawColor(197, 160, 89);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.2);
  y += 6;

  CATERING_CONTRACT_TERMS.forEach((clause) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    const bodyLines = doc.splitTextToSize(clause.content, contentWidth - 4);
    let blockNeeded = 6 + bodyLines.length * 3.9;

    if (clause.rates && clause.rates.length > 0) {
      blockNeeded += 4 + clause.rates.length * 5.5;
    }
    if (clause.alertNotice) {
      blockNeeded += 7;
    }

    ensureSpace(Math.min(blockNeeded + 4, 85));

    // Clause Heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(25, 25, 25);
    const headingText = `${clause.number}. ${clause.title}${
      clause.badge ? `  [${clause.badge.toUpperCase()}]` : ""
    }`;
    doc.text(headingText, marginX, y);
    y += 4.3;

    // Clause Body
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.1);
    doc.setTextColor(55, 55, 55);
    bodyLines.forEach((line: string) => {
      ensureSpace(5);
      doc.text(line, marginX + 3, y);
      y += 3.8;
    });

    // Optional Rate Schedule
    if (clause.rates && clause.rates.length > 0) {
      y += 1;
      clause.rates.forEach((rate) => {
        const noteLines = rate.note
          ? doc.splitTextToSize(`(${rate.note})`, contentWidth - 48)
          : [];
        ensureSpace(5 + noteLines.length * 3.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.setTextColor(40, 40, 40);
        doc.text(`• ${rate.label}`, marginX + 6, y);
        doc.setTextColor(145, 110, 45);
        doc.text(rate.price, pageWidth - marginX - 2, y, { align: "right" });
        y += 3.6;

        if (noteLines.length > 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.3);
          doc.setTextColor(95, 95, 95);
          noteLines.forEach((nl: string) => {
            ensureSpace(4);
            doc.text(nl, marginX + 9, y);
            y += 3.3;
          });
        }
      });
    }

    // Optional Alert Callout
    if (clause.alertNotice) {
      const alertLines = doc.splitTextToSize(clause.alertNotice, contentWidth - 10);
      const alertH = 4 + alertLines.length * 3.6;
      ensureSpace(alertH + 3);
      doc.setFillColor(255, 248, 230);
      doc.setDrawColor(230, 185, 90);
      doc.roundedRect(marginX + 3, y, contentWidth - 6, alertH, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.6);
      doc.setTextColor(145, 90, 15);
      doc.text(alertLines, marginX + 6, y + 3.5);
      y += alertH + 2;
    }

    y += 2.8;
  });

  // =========================================================================
  // 6. EXECUTION & SIGNATURES BLOCK
  // =========================================================================
  ensureSpace(62);
  y += 4;
  doc.setFillColor(248, 246, 241);
  doc.setDrawColor(197, 160, 89);
  doc.roundedRect(marginX, y, contentWidth, 54, 2, 2, "FD");

  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  doc.text("IN WITNESS WHEREOF — CONTRACT EXECUTION & SIGNATURES", marginX + 5, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(70, 70, 70);
  doc.text(
    "By signing below, the CLIENT acknowledges having read, understood, and voluntarily agreed to all twenty (20) clauses of this Catering Service Agreement.",
    marginX + 5,
    y + 12
  );

  const sigLeftX = marginX + 6;
  const sigRightX = marginX + contentWidth / 2 + 6;
  const sigLineY = y + 37;

  // Embed Client Signature Image (drawn canvas PNG or stylized electronic signature fallback)
  let sigImgUrl = data.signature?.signature_data_url || null;
  if (!sigImgUrl && data.termsAccepted) {
    sigImgUrl = renderStylizedSignatureDataUrl(signerName);
  }
  if (sigImgUrl && sigImgUrl.startsWith("data:image/")) {
    try {
      doc.addImage(sigImgUrl, "PNG", sigLeftX + 2, y + 15, 58, 19);
    } catch {
      // Ignore image decode errors and rely on printed name below
    }
  }

  // Caterer Representative Stylized Stamp
  const catererStamp = renderStylizedSignatureDataUrl("Roxan Policarpio");
  if (catererStamp) {
    try {
      doc.addImage(catererStamp, "PNG", sigRightX + 2, y + 15, 58, 19);
    } catch {}
  }

  doc.setDrawColor(80, 80, 80);
  doc.line(sigLeftX, sigLineY, sigLeftX + 74, sigLineY);
  doc.line(sigRightX, sigLineY, sigRightX + 74, sigLineY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(signerName.toUpperCase(), sigLeftX, sigLineY + 4.5);
  doc.text("ROXAN POLICARPIO", sigRightX, sigLineY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);
  doc.setTextColor(95, 95, 95);
  doc.text(
    `Contract Signer (Client) • Signed: ${signedDateLabel}`,
    sigLeftX,
    sigLineY + 8.5
  );
  doc.text(
    `Verified Signer ID: ${String(signerUserId).slice(0, 24)}`,
    sigLeftX,
    sigLineY + 12
  );

  doc.text(
    "Authorized Representative • Roxan Policarpio Events & Catering",
    sigRightX,
    sigLineY + 8.5
  );
  doc.text("Taytay, Rizal, Philippines", sigRightX, sigLineY + 12);

  // =========================================================================
  // 7. RUNNING FOOTER & PAGE NUMBERS ON ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 220, 220);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Roxan Policarpio Events & Catering • Executed Catering Agreement (Ref #${shortRef}) • Signer: ${signerName}`,
      marginX,
      pageHeight - 8.5
    );
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 8.5,
      { align: "right" }
    );
  }

  const safeName = signerName
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Client";
  const safeDate = (data.eventDate || "Event").replace(/[^a-zA-Z0-9_-]+/g, "_");
  doc.save(`Roxan_Policarpio_Signed_Contract_${safeName}_${safeDate}.pdf`);
}

