import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  TRIM_SIZES,
  DEFAULT_TRIM_SIZE_ID,
  PDF_POINTS_PER_INCH,
} from "@/lib/config/kdp-spec";
import type { InteriorLayout } from "@/lib/services/interior-service";

// Print-ready interior PDF. Pages are exactly trim size (8.5×11in =
// 612×792pt), pure white, no crop marks, no watermarks; text pages use an
// embedded OFL-licensed serif (Liberation Serif) so no font is left
// unembedded; artwork pages place the 300-DPI normalised images.

const TRIM = TRIM_SIZES[DEFAULT_TRIM_SIZE_ID];
const PAGE_W = TRIM.widthIn * PDF_POINTS_PER_INCH; // 612
const PAGE_H = TRIM.heightIn * PDF_POINTS_PER_INCH; // 792

const INK = rgb(0.07, 0.06, 0.05);
const FAINT = rgb(0.55, 0.53, 0.5);

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

export interface InteriorPdfInput {
  title: string;
  subtitle: string | null;
  author: string | null;
  layout: InteriorLayout;
  /** pageId → processed (2550×3300) PNG bytes. */
  artwork: Map<string, Buffer>;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCentredLines(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  size: number,
  topY: number,
  colour = INK,
): number {
  let y = topY;
  for (const line of lines) {
    const width = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: (PAGE_W - width) / 2, y, size, font, color: colour });
    y -= size * 1.35;
  }
  return y;
}

export async function buildInteriorPdf(input: InteriorPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const serif = await doc.embedFont(
    await readFile(path.join(FONT_DIR, "LiberationSerif-Regular.ttf")),
  );
  const serifBold = await doc.embedFont(
    await readFile(path.join(FONT_DIR, "LiberationSerif-Bold.ttf")),
  );

  doc.setTitle(input.title);
  if (input.author) doc.setAuthor(input.author);
  doc.setProducer("KDP Colouring Book Studio");
  doc.setCreator("KDP Colouring Book Studio");

  // Cache embedded images so identical bytes embed once.
  const embedded = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();

  for (const slot of input.layout.slots) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    // Pure white ground.
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });

    switch (slot.kind) {
      case "colouring": {
        const bytes = input.artwork.get(slot.art!.pageId);
        if (!bytes) throw new Error(`Missing artwork for "${slot.art!.title}"`);
        let image = embedded.get(slot.art!.pageId);
        if (!image) {
          image = await doc.embedPng(bytes);
          embedded.set(slot.art!.pageId, image);
        }
        // The normalised image is exactly the trim aspect ratio with its own
        // internal safety margin, so it fills the page edge-to-edge.
        page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
        break;
      }
      case "front_matter":
        drawFrontMatter(page, slot.frontMatter!, input, serif, serifBold);
        break;
      case "thank_you": {
        drawCentredLines(page, ["Thank You!"], serifBold, 32, PAGE_H * 0.62);
        const msg = wrapText(
          "We hope you enjoyed colouring this book. Your creativity brought these pages to life.",
          serif,
          13,
          PAGE_W - 160,
        );
        drawCentredLines(page, msg, serif, 13, PAGE_H * 0.62 - 60);
        break;
      }
      case "blank":
        if (input.layout.options.blankPageMessage) {
          const note = "Blank page to help prevent bleed-through.";
          const width = serif.widthOfTextAtSize(note, 8);
          page.drawText(note, {
            x: (PAGE_W - width) / 2,
            y: 60,
            size: 8,
            font: serif,
            color: FAINT,
          });
        }
        break;
    }
  }

  return Buffer.from(await doc.save());
}

function drawFrontMatter(
  page: PDFPage,
  kind: string,
  input: InteriorPdfInput,
  serif: PDFFont,
  serifBold: PDFFont,
) {
  switch (kind) {
    case "titlePage": {
      const titleLines = wrapText(input.title, serifBold, 34, PAGE_W - 140);
      let y = drawCentredLines(page, titleLines, serifBold, 34, PAGE_H * 0.66);
      if (input.subtitle) {
        y -= 14;
        const subLines = wrapText(input.subtitle, serif, 16, PAGE_W - 160);
        y = drawCentredLines(page, subLines, serif, 16, y);
      }
      if (input.author) {
        drawCentredLines(page, [input.author], serif, 14, y - 60);
      }
      break;
    }
    case "copyrightPage": {
      const year = new Date().getFullYear();
      const owner = input.author || input.title;
      const lines = [
        `Copyright © ${year} ${owner}`,
        "All rights reserved.",
        "",
        "No part of this publication may be reproduced, distributed, or",
        "transmitted in any form without the prior written permission of",
        "the publisher, except for personal, non-commercial use.",
      ];
      let y = PAGE_H * 0.3;
      for (const line of lines) {
        if (line === "") {
          y -= 12;
          continue;
        }
        const width = serif.widthOfTextAtSize(line, 10);
        page.drawText(line, { x: (PAGE_W - width) / 2, y, size: 10, font: serif, color: INK });
        y -= 15;
      }
      break;
    }
    case "belongsToPage": {
      drawCentredLines(page, ["This Book Belongs To"], serifBold, 26, PAGE_H * 0.58);
      const lineWidth = 300;
      page.drawLine({
        start: { x: (PAGE_W - lineWidth) / 2, y: PAGE_H * 0.58 - 70 },
        end: { x: (PAGE_W + lineWidth) / 2, y: PAGE_H * 0.58 - 70 },
        thickness: 1.2,
        color: INK,
      });
      break;
    }
    case "testColourPage": {
      drawCentredLines(page, ["Colour Test Page"], serifBold, 24, PAGE_H - 130);
      const hint = wrapText(
        "Try your pens, pencils and markers here before you start colouring.",
        serif,
        12,
        PAGE_W - 180,
      );
      drawCentredLines(page, hint, serif, 12, PAGE_H - 170);
      // Grid of empty swatch boxes.
      const cols = 4;
      const rows = 5;
      const box = 80;
      const gap = 24;
      const gridW = cols * box + (cols - 1) * gap;
      const gridH = rows * box + (rows - 1) * gap;
      const x0 = (PAGE_W - gridW) / 2;
      const y0 = (PAGE_H - 220 - gridH) / 2 + 40;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          page.drawRectangle({
            x: x0 + c * (box + gap),
            y: y0 + r * (box + gap),
            width: box,
            height: box,
            borderColor: INK,
            borderWidth: 1.2,
          });
        }
      }
      break;
    }
  }
}
