const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

function loadJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', filename), 'utf8'));
}

router.get('/', (req, res) => {
  const experiences = loadJSON('experiences.json').sort((a, b) => a.order - b.order);
  const projects = loadJSON('projects.json').sort((a, b) => a.order - b.order);
  let jobsCrm = [];
  try {
    jobsCrm = loadJSON('jobs-crm.json');
  } catch (e) {
    /* optional data file */
  }
  res.render('admin/dashboard', { experiences, projects, jobsCrm });
});

router.get('/experiences/new', (req, res) => {
  res.render('admin/experience-form', { item: null, isNew: true });
});

router.get('/experiences/:id/edit', (req, res) => {
  const experiences = loadJSON('experiences.json');
  const item = experiences.find(e => e.id === req.params.id);
  if (!item) return res.status(404).send('Not found');
  res.render('admin/experience-form', { item, isNew: false });
});

router.get('/projects/new', (req, res) => {
  res.render('admin/project-form', { item: null, isNew: true });
});

router.get('/projects/:id/edit', (req, res) => {
  const projects = loadJSON('projects.json');
  const item = projects.find(p => p.id === req.params.id);
  if (!item) return res.status(404).send('Not found');
  res.render('admin/project-form', { item, isNew: false });
});

module.exports = router;
