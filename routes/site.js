const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

router.get('/', (req, res) => {
  const experiences = loadJSON('experiences.json').sort((a, b) => a.order - b.order);
  const projects = loadJSON('projects.json').sort((a, b) => a.order - b.order);
  res.render('index', { experiences, projects });
});

router.get('/experience/:slug', (req, res) => {
  const experiences = loadJSON('experiences.json');
  const item = experiences.find(e => e.slug === req.params.slug);
  if (!item) return res.status(404).send('Experience not found');
  res.render('detail', { item, itemType: 'experience' });
});

router.get('/project/:slug', (req, res) => {
  const projects = loadJSON('projects.json');
  const item = projects.find(p => p.slug === req.params.slug);
  if (!item) return res.status(404).send('Project not found');
  res.render('detail', { item, itemType: 'project' });
});

module.exports = router;
