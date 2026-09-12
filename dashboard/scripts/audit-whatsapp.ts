import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "../whatsapp");
const executableExtensions = new Set([".go", ".py"]);
const forbidden = [
  /\bsend_message\b/i, /\bsend_file\b/i, /\bsend_audio/i, /\bdownload_media\b/i,
  /client\.SendMessage/, /client\.Upload/, /client\.Download/, /\/api\/send/, /\/api\/download/,
];

async function files(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "store" || entry.name.startsWith(".")) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(target));
    else if (executableExtensions.has(path.extname(entry.name))) result.push(target);
  }
  return result;
}

async function main() {
  const failures: string[] = [];
  for (const filename of await files(root)) {
    const content = await readFile(filename, "utf8");
    for (const pattern of forbidden) if (pattern.test(content)) failures.push(`${path.relative(root, filename)} matches ${pattern}`);
  }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("WhatsApp executable surfaces are read-only.");
}

main().catch((error) => { console.error(error); process.exit(1); });
