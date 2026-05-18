#!/usr/bin/env node
/**
 * Regenerate static experience-*.html and project-*.html from JSON + detail-static.ejs
 * so they match the Express detail pages and home page CSS.
 */
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'views', 'detail-static.ejs');
const template = fs.readFileSync(templatePath, 'utf8');

function writeDetail(item, itemType) {
  const prefix = itemType === 'experience' ? 'experience' : 'project';
  const filename = `${prefix}-${item.slug}.html`;
  const html = ejs.render(template, { item, itemType });
  const outPath = path.join(root, filename);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('wrote', filename);
}

const experiences = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'experiences.json'), 'utf8')
);
const projects = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'projects.json'), 'utf8')
);

experiences.forEach((item) => writeDetail(item, 'experience'));
projects.forEach((item) => writeDetail(item, 'project'));

console.log('Done.');
