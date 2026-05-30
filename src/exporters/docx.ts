import * as fs from "fs";
import { DocProfile } from "../profiles";

// html-to-docx ships no type declarations; load via require.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HTMLtoDOCX = require("html-to-docx");

/** Convert an HTML document to a Word (.docx) file. No Pandoc required. */
export async function exportDocx(
  html: string,
  outPath: string,
  profile: DocProfile
): Promise<void> {
  const options: any = {
    orientation: profile.layout.orientation,
    pageNumber: profile.footer.pageNumbers,
    footer: profile.footer.pageNumbers || !!profile.footer.text,
    header: profile.header.show,
    title: profile.cover.title,
    margins: { top: 720, right: 720, bottom: 720, left: 720 },
    table: { row: { cantSplit: true } },
    font: "Calibri",
  };

  const headerHtml = profile.header.show
    ? `<p style="font-size:9px;color:#888;">${profile.header.text || ""}</p>`
    : undefined;
  const footerHtml =
    profile.footer.text && !profile.footer.pageNumbers
      ? `<p style="font-size:9px;color:#888;">${profile.footer.text}</p>`
      : undefined;

  const result = await HTMLtoDOCX(html, headerHtml ?? null, options, footerHtml ?? null);
  const buffer: Buffer = Buffer.isBuffer(result) ? result : Buffer.from(result);
  await fs.promises.writeFile(outPath, buffer);
}
