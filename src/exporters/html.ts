import * as fs from "fs";

/** Write a complete HTML document to disk. */
export async function exportHtml(html: string, outPath: string): Promise<void> {
  await fs.promises.writeFile(outPath, html, "utf8");
}
