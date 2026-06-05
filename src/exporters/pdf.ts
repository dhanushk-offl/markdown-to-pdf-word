import { DocProfile } from "../profiles";
import { RenderContext, resolvePlaceholders, escapeHtml } from "../render";
import { findBrowser, NoBrowserError } from "./chrome";

/**
 * Render a full HTML document to a PDF file using an installed Chrome/Edge/Chromium
 * via puppeteer-core. puppeteer-core is required lazily so it never loads on
 * activation or during Word/HTML export.
 */
export async function exportPdf(
  html: string,
  outPath: string,
  profile: DocProfile,
  ctx: RenderContext,
  chromePath?: string
): Promise<void> {
  const executablePath = findBrowser(chromePath);
  if (!executablePath) throw new NoBrowserError();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const puppeteer = require("puppeteer-core");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const headerText = escapeHtml(resolvePlaceholders(profile.header.text, ctx, profile));
    const footerText = escapeHtml(resolvePlaceholders(profile.footer.text, ctx, profile));

    const showHeader = profile.header.show;
    const showFooter = profile.footer.pageNumbers || !!footerText;
    const displayHeaderFooter = showHeader || showFooter;

    const headerTemplate = showHeader
      ? `<div style="font-size:9px;width:100%;padding:0 1cm;color:#888;">${headerText}</div>`
      : `<span></span>`;

    const pageNo = profile.footer.pageNumbers
      ? `<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>`
      : `<span></span>`;
    const footerTemplate = showFooter
      ? `<div style="font-size:9px;width:100%;padding:0 1cm;color:#888;display:flex;justify-content:space-between;"><span>${footerText}</span>${pageNo}</div>`
      : `<span></span>`;

    await page.pdf({
      path: outPath,
      format: profile.layout.pageSize,
      landscape: profile.layout.orientation === "landscape",
      printBackground: true,
      displayHeaderFooter,
      headerTemplate,
      footerTemplate,
      margin: {
        top: showHeader ? "2.2cm" : profile.layout.margin,
        bottom: showFooter ? "1.8cm" : profile.layout.margin,
        left: profile.layout.margin,
        right: profile.layout.margin,
      },
    });
  } finally {
    await browser.close();
  }
}
