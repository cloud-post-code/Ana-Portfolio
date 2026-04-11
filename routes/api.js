const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    cb(null, ext || mime);
  }
});

function dataPath(filename) {
  return path.join(__dirname, '..', 'data', filename);
}

function loadData(filename) {
  return JSON.parse(fs.readFileSync(dataPath(filename), 'utf8'));
}

function saveData(filename, data) {
  fs.writeFileSync(dataPath(filename), JSON.stringify(data, null, 2));
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Upload ────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: `uploads/${req.file.filename}`, filename: req.file.filename });
});

router.post('/upload/multiple', upload.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const results = req.files.map(f => ({ path: `uploads/${f.filename}`, filename: f.filename }));
  res.json(results);
});

// ─── Generic CRUD factory ──────────────────────────────────────────────────
function crudRoutes(entityName, filename) {
  // List all
  router.get(`/${entityName}`, (req, res) => {
    const data = loadData(filename).sort((a, b) => a.order - b.order);
    res.json(data);
  });

  // Get one
  router.get(`/${entityName}/:id`, (req, res) => {
    const data = loadData(filename);
    const item = data.find(d => d.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  });

  // Create
  router.post(`/${entityName}`, (req, res) => {
    const data = loadData(filename);
    const newItem = {
      id: `${entityName.slice(0, 3)}-${uuidv4().slice(0, 8)}`,
      slug: slugify(req.body.title || 'untitled'),
      title: req.body.title || '',
      sectionLabel: req.body.sectionLabel || (entityName === 'experiences' ? 'Work experience' : 'Personal project'),
      type: req.body.type || '',
      role: req.body.role || '',
      company: req.body.company || '',
      dateRange: req.body.dateRange || '',
      description: req.body.description || '',
      logo: req.body.logo || '',
      skills: req.body.skills || [],
      subtitle: req.body.subtitle || '',
      meta: req.body.meta || '',
      headerStyle: req.body.headerStyle || 'standard',
      logoWide: req.body.logoWide || false,
      tileClass: req.body.tileClass || '',
      hidden: req.body.hidden || false,
      deliverables: req.body.deliverables || [],
      order: req.body.order != null ? req.body.order : data.length + 1
    };

    // Ensure unique slug
    let slug = newItem.slug;
    let counter = 2;
    while (data.some(d => d.slug === slug)) {
      slug = `${newItem.slug}-${counter++}`;
    }
    newItem.slug = slug;

    data.push(newItem);
    saveData(filename, data);
    res.status(201).json(newItem);
  });

  // Update
  router.put(`/${entityName}/:id`, (req, res) => {
    const data = loadData(filename);
    const idx = data.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const updated = { ...data[idx], ...req.body, id: data[idx].id };
    if (req.body.title && req.body.title !== data[idx].title) {
      updated.slug = slugify(req.body.title);
      let slug = updated.slug;
      let counter = 2;
      while (data.some((d, i) => i !== idx && d.slug === slug)) {
        slug = `${updated.slug}-${counter++}`;
      }
      updated.slug = slug;
    }
    data[idx] = updated;
    saveData(filename, data);
    res.json(updated);
  });

  // Delete
  router.delete(`/${entityName}/:id`, (req, res) => {
    let data = loadData(filename);
    const idx = data.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data.splice(idx, 1);
    saveData(filename, data);
    res.json({ success: true });
  });

  // ─── Deliverable sub-routes ──────────────────────────────────────────────
  router.post(`/${entityName}/:id/deliverables`, (req, res) => {
    const data = loadData(filename);
    const item = data.find(d => d.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const deliverable = {
      id: `del-${uuidv4().slice(0, 8)}`,
      title: req.body.title || '',
      description: req.body.description || '',
      galleryClass: req.body.galleryClass || '',
      media: req.body.media || []
    };

    item.deliverables = item.deliverables || [];
    item.deliverables.push(deliverable);
    saveData(filename, data);
    res.status(201).json(deliverable);
  });

  router.put(`/${entityName}/:id/deliverables/:did`, (req, res) => {
    const data = loadData(filename);
    const item = data.find(d => d.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const delIdx = (item.deliverables || []).findIndex(d => d.id === req.params.did);
    if (delIdx === -1) return res.status(404).json({ error: 'Deliverable not found' });

    item.deliverables[delIdx] = { ...item.deliverables[delIdx], ...req.body, id: req.params.did };
    saveData(filename, data);
    res.json(item.deliverables[delIdx]);
  });

  router.delete(`/${entityName}/:id/deliverables/:did`, (req, res) => {
    const data = loadData(filename);
    const item = data.find(d => d.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    item.deliverables = (item.deliverables || []).filter(d => d.id !== req.params.did);
    saveData(filename, data);
    res.json({ success: true });
  });
}

crudRoutes('experiences', 'experiences.json');
crudRoutes('projects', 'projects.json');

module.exports = router;
