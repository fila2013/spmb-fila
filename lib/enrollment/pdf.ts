import path from "node:path";

import PDFDocument from "pdfkit";

import { FormType } from "@/generated/prisma/enums";

const FONT_REGULAR = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff",
);
const FONT_SEMIBOLD = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans/files/noto-sans-latin-600-normal.woff",
);
const FONT_BOLD = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff",
);

const COLORS = {
  emerald: "#064E3B",
  emeraldLight: "#D1FAE5",
  amber: "#FBBF24",
  slate: "#334155",
  muted: "#64748B",
  border: "#DCE7E3",
  surface: "#F8FAFC",
  white: "#FFFFFF",
};

const PAGE_MARGIN = 42;
const FOOTER_TOP = 782;
const CONTENT_BOTTOM = 774;

export type EnrollmentPdfResponse = {
  id: string;
  label: string;
  value: string | null;
  formType: FormType;
  order: number;
};

export type EnrollmentPdfParticipant = {
  id: string;
  childName: string;
  guardianEmail: string;
  routeName: string | null;
  categoryName: string | null;
  responses: EnrollmentPdfResponse[];
};

export type EnrollmentPdfResult = {
  body: Uint8Array;
  filename: string;
  pageCount: number;
};

type PersonalLayout = {
  columns: number;
  fontSize: number;
  labelSize: number;
  rowHeights: number[];
  clipped: boolean;
};

function cleanText(value: string | null | undefined) {
  return (value?.trim() || "-")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, "    ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function enrollmentPdfFilename(childName: string) {
  const slug = childName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `data-enrollment-${slug || "peserta"}.pdf`;
}

function registerFonts(document: PDFKit.PDFDocument) {
  document.registerFont("Noto", FONT_REGULAR);
  document.registerFont("Noto-Semibold", FONT_SEMIBOLD);
  document.registerFont("Noto-Bold", FONT_BOLD);
}

function participantMeta(participant: EnrollmentPdfParticipant) {
  const route = cleanText(participant.routeName);
  const category = cleanText(participant.categoryName);
  return `${route} | ${category}`;
}

function drawHeader(
  document: PDFKit.PDFDocument,
  participant: EnrollmentPdfParticipant,
  section: "Data Pribadi" | "Observasi",
  continued = false,
) {
  const width = document.page.width - PAGE_MARGIN * 2;
  document
    .save()
    .roundedRect(PAGE_MARGIN, 35, width, 72, 12)
    .fill(COLORS.emerald)
    .restore();

  document
    .font("Noto-Semibold")
    .fontSize(7.5)
    .fillColor(COLORS.amber)
    .text("SPMB SDIT FITRAH INSANI LANGKAPURA", PAGE_MARGIN + 18, 50, {
      width: width - 36,
      characterSpacing: 0.7,
    });
  document
    .font("Noto-Bold")
    .fontSize(18)
    .fillColor(COLORS.white)
    .text("Data Enrollment Peserta", PAGE_MARGIN + 18, 67, {
      width: width - 36,
    });
  document
    .font("Noto")
    .fontSize(8)
    .fillColor("#D1FAE5")
    .text(
      `${section}${continued ? " - lanjutan" : ""}`,
      PAGE_MARGIN + 18,
      91,
      { width: width - 36 },
    );

  const metaTop = 118;
  document
    .save()
    .roundedRect(PAGE_MARGIN, metaTop, width, 42, 8)
    .fillAndStroke(COLORS.surface, COLORS.border)
    .restore();
  document
    .font("Noto-Semibold")
    .fontSize(8.5)
    .fillColor(COLORS.emerald)
    .text(cleanText(participant.childName), PAGE_MARGIN + 13, metaTop + 8, {
      width: width * 0.48,
      ellipsis: true,
      lineBreak: false,
    });
  document
    .font("Noto")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(participantMeta(participant), PAGE_MARGIN + 13, metaTop + 23, {
      width: width * 0.48,
      ellipsis: true,
      lineBreak: false,
    });
  document
    .font("Noto")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(
      `Email wali: ${cleanText(participant.guardianEmail)}`,
      PAGE_MARGIN + width * 0.53,
      metaTop + 13,
      {
        width: width * 0.43,
        align: "right",
        ellipsis: true,
        lineBreak: false,
      },
    );

  return 181;
}

function sectionHeading(
  document: PDFKit.PDFDocument,
  title: string,
  description: string,
  y: number,
) {
  document
    .font("Noto-Bold")
    .fontSize(11)
    .fillColor(COLORS.emerald)
    .text(title.toUpperCase(), PAGE_MARGIN, y, { characterSpacing: 0.6 });
  document
    .font("Noto")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(description, PAGE_MARGIN, y + 17, {
      width: document.page.width - PAGE_MARGIN * 2,
    });
  return y + 39;
}

function personalRowHeights(
  document: PDFKit.PDFDocument,
  responses: EnrollmentPdfResponse[],
  columns: number,
  fontSize: number,
  labelSize: number,
) {
  const gap = 9;
  const width = document.page.width - PAGE_MARGIN * 2;
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const heights: number[] = [];

  for (let index = 0; index < responses.length; index += columns) {
    const row = responses.slice(index, index + columns);
    const rowHeight = Math.max(
      ...row.map((response) => {
        document.font("Noto-Semibold").fontSize(labelSize);
        const labelHeight = document.heightOfString(
          cleanText(response.label).toUpperCase(),
          { width: cardWidth - 22, lineGap: 1 },
        );
        document.font("Noto").fontSize(fontSize);
        const valueHeight = document.heightOfString(cleanText(response.value), {
          width: cardWidth - 22,
          lineGap: 1.4,
        });
        return Math.max(47, 20 + labelHeight + valueHeight);
      }),
    );
    heights.push(rowHeight);
  }
  return heights;
}

function selectPersonalLayout(
  document: PDFKit.PDFDocument,
  responses: EnrollmentPdfResponse[],
  availableHeight: number,
): PersonalLayout {
  const attempts = [
    { columns: 2, maximum: 9.5, minimum: 6.5 },
    { columns: 3, maximum: 8.5, minimum: 5 },
  ];
  for (const attempt of attempts) {
    for (
      let fontSize = attempt.maximum;
      fontSize >= attempt.minimum;
      fontSize -= 0.5
    ) {
      const labelSize = Math.max(fontSize - 1.7, 4.5);
      const rowHeights = personalRowHeights(
        document,
        responses,
        attempt.columns,
        fontSize,
        labelSize,
      );
      const total =
        rowHeights.reduce((sum, height) => sum + height, 0) +
        Math.max(rowHeights.length - 1, 0) * 9;
      if (total <= availableHeight) {
        return {
          columns: attempt.columns,
          fontSize,
          labelSize,
          rowHeights,
          clipped: false,
        };
      }
    }
  }

  const columns = 3;
  const rowCount = Math.ceil(responses.length / columns);
  const totalGap = Math.max(rowCount - 1, 0) * 9;
  const rowHeight = Math.max((availableHeight - totalGap) / rowCount, 1);
  return {
    columns,
    fontSize: 5,
    labelSize: 4.5,
    rowHeights: Array.from({ length: rowCount }, () => rowHeight),
    clipped: true,
  };
}

function drawPersonalResponses(
  document: PDFKit.PDFDocument,
  responses: EnrollmentPdfResponse[],
  startY: number,
) {
  if (responses.length === 0) {
    document
      .font("Noto")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Belum ada jawaban Data Pribadi.", PAGE_MARGIN, startY);
    return;
  }

  const availableHeight = CONTENT_BOTTOM - startY;
  const layout = selectPersonalLayout(document, responses, availableHeight);
  const width = document.page.width - PAGE_MARGIN * 2;
  const gap = 9;
  const cardWidth = (width - gap * (layout.columns - 1)) / layout.columns;
  let y = startY;

  for (let index = 0; index < responses.length; index += layout.columns) {
    const row = responses.slice(index, index + layout.columns);
    const rowHeight = layout.rowHeights[Math.floor(index / layout.columns)];
    row.forEach((response, column) => {
      const x = PAGE_MARGIN + column * (cardWidth + gap);
      document
        .save()
        .roundedRect(x, y, cardWidth, rowHeight, 8)
        .fillAndStroke(COLORS.surface, COLORS.border)
        .restore();
      document
        .save()
        .roundedRect(x, y, 4, rowHeight, 2)
        .fill(COLORS.emerald)
        .restore();
      document
        .font("Noto-Semibold")
        .fontSize(layout.labelSize)
        .fillColor(COLORS.muted)
        .text(cleanText(response.label).toUpperCase(), x + 12, y + 9, {
          width: cardWidth - 22,
          ...(layout.clipped
            ? {
                height: Math.max(Math.min(rowHeight * 0.3, 34), 6),
                ellipsis: true,
              }
            : {}),
          lineGap: 1,
        });
      const valueY = layout.clipped
        ? y + 13 + Math.max(Math.min(rowHeight * 0.3, 34), 6)
        : document.y + 4;
      document
        .font("Noto")
        .fontSize(layout.fontSize)
        .fillColor(COLORS.slate)
        .text(cleanText(response.value), x + 12, valueY, {
          width: cardWidth - 22,
          ...(layout.clipped
            ? {
                height: Math.max(rowHeight - (valueY - y) - 8, 1),
                ellipsis: true,
              }
            : {}),
          lineGap: 1.4,
        });
    });
    y += rowHeight + gap;
  }
}

type WrappedText = {
  lines: string[];
  lineHeight: number;
  height: number;
};

function wrapTextLines(
  document: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: string,
  fontSize: number,
  lineHeight: number,
): WrappedText {
  document.font(font).fontSize(fontSize);
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (document.widthOfString(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (document.widthOfString(word) <= width) {
        line = word;
        continue;
      }

      let fragment = "";
      for (const character of word) {
        const candidateFragment = `${fragment}${character}`;
        if (fragment && document.widthOfString(candidateFragment) > width) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = candidateFragment;
        }
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }

  const safeLines = lines.length > 0 ? lines : ["-"];
  return {
    lines: safeLines,
    lineHeight,
    height: safeLines.length * lineHeight,
  };
}

function observationMetrics(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  width: number,
) {
  const labelBlock = wrapTextLines(
    document,
    label,
    width - 47,
    "Noto-Semibold",
    8,
    10.5,
  );
  const valueBlock = wrapTextLines(
    document,
    value,
    width - 26,
    "Noto",
    8.7,
    11.5,
  );
  return {
    labelBlock,
    valueBlock,
    labelHeight: labelBlock.height,
    valueHeight: valueBlock.height,
    totalHeight: 19 + labelBlock.height + valueBlock.height,
  };
}

function fittingTextChunk(
  document: PDFKit.PDFDocument,
  text: string,
  width: number,
  maximumHeight: number,
) {
  const wrapped = wrapTextLines(
    document,
    text,
    width,
    "Noto",
    8.7,
    11.5,
  );
  const maximumLines = Math.max(
    1,
    Math.floor(maximumHeight / wrapped.lineHeight),
  );
  return {
    chunk: wrapped.lines.slice(0, maximumLines).join("\n"),
    rest: wrapped.lines.slice(maximumLines).join("\n"),
  };
}

function drawWrappedText(
  document: PDFKit.PDFDocument,
  block: WrappedText,
  input: {
    x: number;
    y: number;
    font: string;
    fontSize: number;
    color: string;
  },
) {
  document.font(input.font).fontSize(input.fontSize).fillColor(input.color);
  block.lines.forEach((line, lineIndex) => {
    if (!line) return;
    document.text(line, input.x, input.y + lineIndex * block.lineHeight, {
      lineBreak: false,
    });
  });
}

function drawObservationCard(
  document: PDFKit.PDFDocument,
  index: number,
  label: string,
  value: string,
  y: number,
) {
  const width = document.page.width - PAGE_MARGIN * 2;
  const metrics = observationMetrics(document, label, value, width);
  const cardHeight = metrics.totalHeight;
  document
    .save()
    .roundedRect(PAGE_MARGIN, y, width, cardHeight, 8)
    .fillAndStroke(COLORS.surface, COLORS.border)
    .restore();
  document
    .save()
    .circle(PAGE_MARGIN + 17, y + 14, 7)
    .fill(COLORS.emerald)
    .restore();
  document
    .font("Noto-Bold")
    .fontSize(6.5)
    .fillColor(COLORS.white)
    .text(String(index), PAGE_MARGIN + 10, y + 10, {
      width: 14,
      align: "center",
      lineBreak: false,
    });
  drawWrappedText(document, metrics.labelBlock, {
    x: PAGE_MARGIN + 34,
    y: y + 8,
    font: "Noto-Semibold",
    fontSize: 8,
    color: COLORS.emerald,
  });
  drawWrappedText(document, metrics.valueBlock, {
    x: PAGE_MARGIN + 13,
    y: y + 12 + metrics.labelHeight,
    font: "Noto",
    fontSize: 8.7,
    color: COLORS.slate,
  });
  return y + cardHeight + 4;
}

function addObservationPage(
  document: PDFKit.PDFDocument,
  participant: EnrollmentPdfParticipant,
  continued: boolean,
) {
  document.addPage({ size: "A4", margin: PAGE_MARGIN });
  const headerBottom = drawHeader(
    document,
    participant,
    "Observasi",
    continued,
  );
  return sectionHeading(
    document,
    continued ? "Observasi - lanjutan" : "Observasi",
    "Jawaban orang tua/wali mengenai kebiasaan, pendampingan, dan perkembangan anak.",
    headerBottom,
  );
}

function drawObservationResponses(
  document: PDFKit.PDFDocument,
  participant: EnrollmentPdfParticipant,
  responses: EnrollmentPdfResponse[],
) {
  let y = addObservationPage(document, participant, false);
  if (responses.length === 0) {
    document
      .font("Noto")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Belum ada jawaban Observasi.", PAGE_MARGIN, y);
    return;
  }

  const width = document.page.width - PAGE_MARGIN * 2;
  const fullPageStart = y;
  const fullPageHeight = CONTENT_BOTTOM - fullPageStart;

  responses.forEach((response, responseIndex) => {
    const index = responseIndex + 1;
    const baseLabel = cleanText(response.label);
    let value = cleanText(response.value);
    let continuation = false;

    while (value) {
      const label = continuation ? `${baseLabel} (lanjutan)` : baseLabel;
      let metrics = observationMetrics(document, label, value, width);
      const remaining = CONTENT_BOTTOM - y;

      if (metrics.totalHeight <= fullPageHeight && metrics.totalHeight > remaining) {
        y = addObservationPage(document, participant, true);
        metrics = observationMetrics(document, label, value, width);
      }

      if (metrics.totalHeight <= CONTENT_BOTTOM - y) {
        y = drawObservationCard(document, index, label, value, y);
        value = "";
        continue;
      }

      const labelOnly = observationMetrics(document, label, "-", width);
      const maximumTextHeight = Math.max(
        CONTENT_BOTTOM - y - labelOnly.labelHeight - 21,
        18,
      );
      const piece = fittingTextChunk(
        document,
        value,
        width - 26,
        maximumTextHeight,
      );
      y = drawObservationCard(document, index, label, piece.chunk, y);
      value = piece.rest;
      continuation = true;
      if (value) y = addObservationPage(document, participant, true);
    }
  });
}

function drawFooters(
  document: PDFKit.PDFDocument,
  participant: EnrollmentPdfParticipant,
) {
  const range = document.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    document.switchToPage(range.start + index);
    document
      .save()
      .moveTo(PAGE_MARGIN, FOOTER_TOP)
      .lineTo(document.page.width - PAGE_MARGIN, FOOTER_TOP)
      .strokeColor(COLORS.border)
      .lineWidth(0.7)
      .stroke()
      .restore();
    document
      .font("Noto")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(cleanText(participant.childName), PAGE_MARGIN, FOOTER_TOP + 6, {
        width: 280,
        ellipsis: true,
        lineBreak: false,
      });
    document.text(
      `Halaman ${index + 1} dari ${range.count}`,
      document.page.width - PAGE_MARGIN - 150,
      FOOTER_TOP + 6,
      { width: 150, align: "right", lineBreak: false },
    );
  }
  return range.count;
}

function pdfBuffer(document: PDFKit.PDFDocument) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    document.on("error", reject);
    document.end();
  });
}

export async function createEnrollmentPdf(
  participant: EnrollmentPdfParticipant,
): Promise<EnrollmentPdfResult> {
  const document = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    info: {
      Title: `Data Enrollment - ${cleanText(participant.childName)}`,
      Author: "SPMB SDIT Fitrah Insani Langkapura",
      Subject: "Data Pribadi dan Observasi peserta SPMB",
      Creator: "SPMB Fila",
    },
  });
  registerFonts(document);

  const personalResponses = participant.responses
    .filter((response) => response.formType === FormType.DATA_PRIBADI)
    .sort((left, right) => left.order - right.order);
  const observationResponses = participant.responses
    .filter((response) => response.formType === FormType.OBSERVASI)
    .sort((left, right) => left.order - right.order);

  document.addPage({ size: "A4", margin: PAGE_MARGIN });
  const personalHeaderBottom = drawHeader(
    document,
    participant,
    "Data Pribadi",
  );
  const personalStart = sectionHeading(
    document,
    "Data Pribadi",
    "Identitas peserta dan data kontak orang tua/wali.",
    personalHeaderBottom,
  );
  drawPersonalResponses(document, personalResponses, personalStart);
  drawObservationResponses(document, participant, observationResponses);

  const pageCount = drawFooters(document, participant);
  const body = await pdfBuffer(document);
  return {
    body,
    filename: enrollmentPdfFilename(participant.childName),
    pageCount,
  };
}
