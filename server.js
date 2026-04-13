const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/logos', express.static(path.join(__dirname, 'Logos portfolio')));
app.use('/Logos portfolio', express.static(path.join(__dirname, 'Logos portfolio')));

const siteRoutes = require('./routes/site');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const { initDb, isDatabaseEnabled } = require('./lib/db');

app.use('/api', apiRoutes);
app.use('/admin', (req, res, next) => {
  res.locals.adminEnhanceSecret = process.env.ADMIN_ENHANCE_SECRET || '';
  next();
});
app.use('/admin', adminRoutes);
app.use('/', siteRoutes);

app.use(function (err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  const msg = err.message || String(err);
  if (req.originalUrl && String(req.originalUrl).indexOf('/api') === 0) {
    return res.status(500).json({ error: msg });
  }
  res.status(500).send(process.env.NODE_ENV === 'production' ? 'Server error' : msg);
});

async function boot() {
  try {
    if (isDatabaseEnabled()) {
      await initDb();
      console.log('PostgreSQL: connected and schema ready');
    } else {
      console.log('CMS: using JSON files under data/ (set DATABASE_URL for PostgreSQL)');
    }
  } catch (e) {
    console.error('Database init failed:', e.message || e);
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
    console.log(`Admin panel at /admin`);
  });
}

boot();
