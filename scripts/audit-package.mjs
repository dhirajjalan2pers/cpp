import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || "starter-kit");
const forbiddenNames = [/^\.env(?!\.example$)/, /\.db(?:-wal|-shm)?$/, /\.pdf$/i, /^node_modules$/, /^\.next$/, /^dist$/];
const forbiddenText = [
  new RegExp(["dh", "ruv"].join(""), "i"),
  new RegExp(["GoogleDrive", "hello@"].join("-"), "i"),
  new RegExp(["sk", "ant"].join("-"), "i"),
  /(?:OPENAI|ANTHROPIC)_API_KEY\s*=/i,
  /Cookie:\s*["'][^"'\n]{20,}/i,
  /\/Users\/[A-Za-z0-9._-]+\//,
];
const failures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    const relative = path.relative(root, target);
    if (forbiddenNames.some((pattern) => pattern.test(entry.name))) { failures.push(`Forbidden artifact: ${relative}`); continue; }
    if (entry.isDirectory()) { await walk(target); continue; }
    if ((await stat(target)).size > 15 * 1024 * 1024) failures.push(`Unexpected large file: ${relative}`);
    const content = await readFile(target, "utf8");
    for (const pattern of forbiddenText) if (pattern.test(content)) failures.push(`Sensitive pattern ${pattern} in ${relative}`);
  }
}
await walk(root);
if (failures.length) { console.error([...new Set(failures)].join("\n")); process.exit(1); }
console.log(`Package audit passed: ${root}`);
