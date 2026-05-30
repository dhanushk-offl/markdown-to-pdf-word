import puppeteer from "puppeteer";
import { DocProfile } from "../profiles";
import { RenderContext, resolvePlaceholders, escapeHtml } from "../render";

/** Render a full HTML document to a PDF file using headless Chromium. */
export async function exportPdf(
  html: string,
  outPath: string,
  profile: DocProfile,
  ctx: RenderContext
): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
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
