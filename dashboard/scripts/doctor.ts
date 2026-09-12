import { config } from "dotenv";
config({ path: ".env.local" });
import { getPool } from "../src/lib/db";

const required = ["DATABASE_URL", "SITE_PASSWORD", "AUTH_SECRET", "DATA_ENCRYPTION_KEY", "CPP_EXTENSION_API_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}
if (Buffer.from(process.env.DATA_ENCRYPTION_KEY!, "base64").length !== 32) {
  console.error("DATA_ENCRYPTION_KEY must decode to 32 bytes");
  process.exit(1);
}
if (process.env.AUTH_SECRET!.length < 32) {
  console.error("AUTH_SECRET must be at least 32 characters");
  process.exit(1);
}
await getPool().query("SELECT 1");
console.log("Configuration and database connection look healthy.");
await getPool().end();
