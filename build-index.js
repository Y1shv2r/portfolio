#!/usr/bin/env node
/**
 * build-index.js
 * Run: node build-index.js
 * Scans content/projects and content/blogs, reads each meta.json,
 * and writes content/index.json for the frontend to fetch.
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, 'content');
const OUT     = path.join(ROOT, 'index.json');

function readSection(section) {
  const dir = path.join(ROOT, section);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(name => {
      const full = path.join(dir, name);
      return fs.statSync(full).isDirectory();
    })
    .map(slug => {
      const metaPath = path.join(dir, slug, 'meta.json');
      if (!fs.existsSync(metaPath)) {
        console.warn(`  ⚠  Skipping ${section}/${slug} — no meta.json found`);
        return null;
      }

      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch (e) {
        console.warn(`  ⚠  Skipping ${section}/${slug} — invalid JSON: ${e.message}`);
        return null;
      }

      // Validate required fields
      const required = ['title', 'date', 'tags', 'description', 'blocks'];
      for (const field of required) {
        if (!(field in meta)) {
          console.warn(`  ⚠  ${section}/${slug}/meta.json missing required field: "${field}"`);
        }
      }

      // Validate blocks
      const validTypes = ['text', 'image', 'video', 'doc'];
      (meta.blocks || []).forEach((block, i) => {
        if (!validTypes.includes(block.type)) {
          console.warn(`  ⚠  ${section}/${slug} block[${i}] has unknown type: "${block.type}"`);
        }
        if (block.type !== 'text' && !block.src) {
          console.warn(`  ⚠  ${section}/${slug} block[${i}] (${block.type}) is missing "src"`);
        }
      });

      return {
        slug,
        section,
        title:       meta.title       || slug,
        date:        meta.date        || '',
        tags:        meta.tags        || [],
        description: meta.description || '',
        blocks:      meta.blocks      || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
}

const index = {
  generated: new Date().toISOString(),
  projects:  readSection('projects'),
  blogs:     readSection('blogs'),
};

fs.writeFileSync(OUT, JSON.stringify(index, null, 2), 'utf8');

console.log(`\n✓ index.json written`);
console.log(`  projects : ${index.projects.length}`);
console.log(`  blogs    : ${index.blogs.length}`);
console.log(`  output   : ${OUT}\n`);
