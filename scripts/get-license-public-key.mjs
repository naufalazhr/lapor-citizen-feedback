/**
 * get-license-public-key.mjs
 *
 * Derives the LICENSE_PUBLIC_KEY (64-char hex) from the VITE_LICENSE_PRIVATE_KEY
 * stored in citizen-admin-hub/.env using Node.js built-in crypto.
 *
 * Usage: node scripts/get-license-public-key.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createPrivateKey, createPublicKey } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 1. Read private key from citizen-admin-hub/.env ──────────────────────────
const envPath = join(__dirname, "../../../superadmin/citizen-admin-hub/.env");

let privateKeyHex;
try {
  const envContent = readFileSync(envPath, "utf-8");
  const match = envContent.match(/VITE_LICENSE_PRIVATE_KEY=([a-fA-F0-9]+)/);
  if (!match) {
    console.error("ERROR: VITE_LICENSE_PRIVATE_KEY not found in citizen-admin-hub/.env");
    process.exit(1);
  }
  privateKeyHex = match[1];
} catch (err) {
  console.error("ERROR: Could not read citizen-admin-hub/.env");
  console.error("Path tried:", envPath);
  console.error(err.message);
  process.exit(1);
}

// ── 2. Wrap 32-byte raw private key in PKCS#8 DER format ─────────────────────
// Ed25519 PKCS#8 DER structure prefix (ASN.1):
//   SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING { OCTET STRING { <32 bytes> } } }
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const rawPrivateKey = Buffer.from(privateKeyHex, "hex");

if (rawPrivateKey.length !== 32) {
  console.error(`ERROR: Private key must be 32 bytes, got ${rawPrivateKey.length}`);
  process.exit(1);
}

const pkcs8Der = Buffer.concat([PKCS8_PREFIX, rawPrivateKey]);

// ── 3. Import and derive public key ──────────────────────────────────────────
const privateKey = createPrivateKey({ key: pkcs8Der, format: "der", type: "pkcs8" });
const publicKey = createPublicKey(privateKey);

// Export as SPKI DER — last 32 bytes are the raw Ed25519 public key
const spkiDer = publicKey.export({ type: "spki", format: "der" });
const publicKeyHex = spkiDer.subarray(-32).toString("hex");

// ── 4. Print result ───────────────────────────────────────────────────────────
console.log("");
console.log("=== LICENSE_PUBLIC_KEY (64-char hex) ===");
console.log("");
console.log(publicKeyHex);
console.log("");
console.log("Add this line to your .env.functions file:");
console.log(`LICENSE_PUBLIC_KEY=${publicKeyHex}`);
console.log("");
