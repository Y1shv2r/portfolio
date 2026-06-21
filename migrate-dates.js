#!/usr/bin/env node
/**
 * migrate-dates.js — one-time migration.
 * Converts old-style "date": "YYYY-MM" in meta.json files to
 * "startDate": "YYYY-MM", "endDate": "" (ongoing).
 *
 * Run once:  node migrate-dates.js
 * Safe to re-run — skips files that are already migrated.
 * Delete this file afterwards, you won't need it again.
 */

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, 'content');
const sections = ['projects', 'blogs'];

let migrated = 0, skipped = 0;

for (const section of sections) {
  const dir = path.join(CONTENT_DIR, section);
  if (!fs.existsSync(dir)) continue;

  for (const slug of fs.readdirSync(dir)) {
    const metaPath = path.join(dir, slug, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    if (meta.startDate !== undefined) {
      console.log(`  - ${section}/${slug}: already migrated, skipping`);
      skipped++;
      continue;
    }
    if (meta.date === undefined) {
      console.log(`  ⚠  ${section}/${slug}: no "date" field found, skipping`);
      skipped++;
      continue;
    }

    const newMeta = {
      title: meta.title,
      startDate: meta.date,
      endDate: '',
      tags: meta.tags,
      description: meta.description,
      blocks: meta.blocks,
    };

    fs.writeFileSync(metaPath, JSON.stringify(newMeta, null, 2) + '\n', 'utf8');
    console.log(`  ✓ ${section}/${slug}: migrated (startDate=${meta.date}, endDate="")`);
    migrated++;
  }
}

console.log(`\nDone. Migrated: ${migrated}, skipped: ${skipped}.\n`);
if (migrated > 0) {
  console.log('Now run: node build-index.js');
}
