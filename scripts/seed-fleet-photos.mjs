#!/usr/bin/env node
// GetOnShows · Demo fleet photo upload.
//
// Uploads the 66 AI-generated fleet portraits to the public `profile-photos`
// bucket and sets each fleet profile's photo_url.
//
// Run AFTER seed-demo-fleet.mjs, from the folder that also contains the
// `fleet-photos/` directory (66 JPGs named fleet-guest-01.jpg … fleet-host-26.jpg):
//
//   SUPABASE_URL=https://xyz.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node seed-fleet-photos.mjs [path/to/fleet-photos]
//
// Requires the service_role key. Never commit real keys; pass via env only.

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DEMO_DOMAIN = "@getonshows.demo";
const PHOTOS_DIR = process.argv[2] ?? path.join(process.cwd(), "fleet-photos");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(2);
}
if (!fs.existsSync(PHOTOS_DIR)) {
  console.error(`Photos directory not found: ${PHOTOS_DIR}`);
  process.exit(2);
}

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const restHeaders = { ...adminHeaders, Prefer: "return=representation" };
const REST = `${SUPABASE_URL}/rest/v1`;
const STORAGE = `${SUPABASE_URL}/storage/v1/object`;

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${options.method ?? "GET"} ${url} → ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const files = fs
    .readdirSync(PHOTOS_DIR)
    .filter((f) => /^fleet-(host|guest)-\d+\.jpg$/.test(f))
    .sort();
  if (files.length === 0) {
    console.error(`No fleet-*.jpg files found in ${PHOTOS_DIR}`);
    process.exit(2);
  }
  console.log(`Uploading ${files.length} fleet photos...`);

  let done = 0;
  let skipped = 0;
  for (const file of files) {
    const slug = path.basename(file, ".jpg"); // fleet-guest-01
    const email = `${slug}${DEMO_DOMAIN}`;

    const users = await api(
      `${REST}/users?email=eq.${encodeURIComponent(email)}&select=id`,
      { headers: restHeaders }
    );
    if (users.length === 0) {
      console.log(`  skip (no user): ${email}`);
      skipped++;
      continue;
    }
    const profiles = await api(
      `${REST}/profiles?user_id=eq.${users[0].id}&select=id`,
      { headers: restHeaders }
    );
    if (profiles.length === 0) {
      console.log(`  skip (no profile): ${email}`);
      skipped++;
      continue;
    }

    const bytes = fs.readFileSync(path.join(PHOTOS_DIR, file));
    const storagePath = `fleet/${file}`;
    const up = await fetch(`${STORAGE}/profile-photos/${storagePath}`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!up.ok) {
      throw new Error(`upload ${file} → ${up.status}: ${(await up.text()).slice(0, 200)}`);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/profile-photos/${storagePath}`;
    await api(`${REST}/profiles?id=eq.${profiles[0].id}`, {
      method: "PATCH",
      headers: restHeaders,
      body: JSON.stringify({ photo_url: publicUrl }),
    });
    done++;
    if (done % 10 === 0) console.log(`  ...${done} done`);
  }
  console.log(`Done. ${done} photo(s) uploaded and linked, ${skipped} skipped.`);
}

main().catch((e) => {
  console.error("Photo upload failed:", e.message);
  process.exit(1);
});
