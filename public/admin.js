/* ─── Toast notifications ─────────────────────────────────────────────── */
function showToast(message, type) {
  let toast = document.querySelector('.admin__toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'admin__toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'admin__toast admin__toast--' + type + ' admin__toast--visible';
  setTimeout(function () {
    toast.classList.remove('admin__toast--visible');
  }, 3000);
}

/* ─── AI / web enhancement ───────────────────────────────────────────── */
function enhanceFetchHeaders() {
  var h = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined' && window.__ADMIN_ENHANCE_SECRET__) {
    h['x-enhance-secret'] = window.__ADMIN_ENHANCE_SECRET__;
  }
  return h;
}

function enhanceOne(collection, id) {
  fetch('/api/enhance', {
    method: 'POST',
    headers: enhanceFetchHeaders(),
    body: JSON.stringify({ collection: collection, id: id })
  })
    .then(function (res) {
      return res.json().then(function (j) {
        return { ok: res.ok, j: j };
      });
    })
    .then(function (o) {
      if (!o.ok) throw new Error((o.j && o.j.error) || 'Enhance failed');
      var msg = (o.j.updated && o.j.updated.length)
        ? ('Updated: ' + o.j.updated.join(', '))
        : (o.j.message || 'Done');
      showToast(msg, 'success');
      setTimeout(function () {
        location.reload();
      }, 700);
    })
    .catch(function (e) {
      showToast(e.message || 'Enhance failed', 'error');
    });
}

function enhanceAllCollection(collection) {
  if (!confirm('Fill empty fields using web context + AI (up to 20 items per run). Uses API credits. Continue?')) return;
  showToast('Enhancing… this can take a few minutes.', 'success');
  fetch('/api/enhance', {
    method: 'POST',
    headers: enhanceFetchHeaders(),
    body: JSON.stringify({ collection: collection, all: true })
  })
    .then(function (res) {
      return res.json().then(function (j) {
        return { ok: res.ok, j: j };
      });
    })
    .then(function (o) {
      if (!o.ok) throw new Error((o.j && o.j.error) || 'Enhance failed');
      var j = o.j;
      var msg = 'Processed ' + j.processed + (j.total > j.processed ? (' of ' + j.total + ' total') : '');
      if (j.errors && j.errors.length) msg += ' (' + j.errors.length + ' errors)';
      showToast(msg, 'success');
      setTimeout(function () {
        location.reload();
      }, 800);
    })
    .catch(function (e) {
      showToast(e.message || 'Enhance failed', 'error');
    });
}

/* ─── Delete item from dashboard ──────────────────────────────────────── */
function deleteItem(entity, id) {
  if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) return;
  fetch('/api/' + encodeURIComponent(entity) + '/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function (res) {
      var ct = (res.headers.get('Content-Type') || '').toLowerCase();
      if (ct.indexOf('application/json') >= 0) {
        return res.json().then(function (j) {
          return { ok: res.ok, j: j };
        });
      }
      return res.text().then(function (t) {
        return { ok: res.ok, j: { error: (t && t.slice(0, 200)) || 'Delete failed (' + res.status + ')' } };
      });
    })
    .then(function (o) {
      if (!o.ok) throw new Error((o.j && o.j.error) || 'Delete failed');
      showToast('Deleted successfully', 'success');
      setTimeout(function () {
        window.location.href = '/admin';
      }, 400);
    })
    .catch(function (e) {
      showToast(e.message || 'Delete failed', 'error');
    });
}

/* ─── Upload single file (logo) ──────────────────────────────────────── */
function uploadFile(fileInput, fieldName) {
  var file = fileInput.files[0];
  if (!file) return;
  var formData = new FormData();
  formData.append('file', file);

  fetch('/api/upload', { method: 'POST', body: formData })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var textInput = fileInput.closest('.admin__file-input').querySelector('input[type="text"]');
      textInput.value = data.path;
      showToast('Logo uploaded', 'success');
    })
    .catch(function () { showToast('Upload failed', 'error'); });
}

/* ─── Upload media files into a deliverable ──────────────────────────── */
function uploadMedia(fileInput) {
  var files = fileInput.files;
  if (!files.length) return;

  var formData = new FormData();
  for (var i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  var mediaGrid = fileInput.closest('.admin__media-section').querySelector('.admin__media-grid');

  fetch('/api/upload/multiple', { method: 'POST', body: formData })
    .then(function (res) { return res.json(); })
    .then(function (results) {
      results.forEach(function (r) {
        var isVideo = /\.(mp4|webm|mov)$/i.test(r.filename);
        var mediaType = isVideo ? 'video-hover' : 'image';
        addMediaItem(mediaGrid, mediaType, r.path, r.filename);
      });
      showToast(results.length + ' file(s) uploaded', 'success');
    })
    .catch(function () { showToast('Upload failed', 'error'); });

  fileInput.value = '';
}

/* ─── Add media item manually ────────────────────────────────────────── */
function addMediaManual(btn) {
  var mediaGrid = btn.closest('.admin__media-section').querySelector('.admin__media-grid');
  addMediaItem(mediaGrid, 'image', '', '');
}

function addMediaItem(grid, type, src, alt) {
  var isVideo = type !== 'image';
  var previewHTML = src
    ? (isVideo
      ? '<video src="/' + src + '" muted></video>'
      : '<img src="/' + src + '" alt="" />')
    : '';

  var html =
    '<div class="admin__media-item">' +
      '<span class="admin__media-drag" title="Drag to reorder">&#9776;</span>' +
      '<div class="admin__media-preview">' + previewHTML + '</div>' +
      '<div class="admin__media-fields">' +
        '<select name="media_type">' +
          '<option value="image"' + (type === 'image' ? ' selected' : '') + '>Image</option>' +
          '<option value="video-hover"' + (type === 'video-hover' ? ' selected' : '') + '>Video (hover play)</option>' +
          '<option value="video-still"' + (type === 'video-still' ? ' selected' : '') + '>Video (still frame)</option>' +
        '</select>' +
        '<input type="text" name="media_src" value="' + src + '" placeholder="File path" />' +
        '<input type="text" name="media_alt" value="' + alt + '" placeholder="Alt text" />' +
      '</div>' +
      '<button type="button" class="admin__media-remove" onclick="this.closest(\'.admin__media-item\').remove()" title="Remove">&times;</button>' +
    '</div>';

  grid.insertAdjacentHTML('beforeend', html);
  initMediaDragAndDrop(grid);
}

/* ─── Add deliverable sub-group ──────────────────────────────────────── */
function addDeliverable() {
  var list = document.getElementById('deliverablesList');
  if (!list) return;
  var wrap = list.closest('details.admin__advanced--deliverables');
  if (wrap) wrap.open = true;
  var count = list.querySelectorAll('.admin__deliverable').length + 1;

  var html =
    '<div class="admin__deliverable" data-del-id="">' +
      '<div class="admin__deliverable-header">' +
        '<span class="admin__deliverable-drag" title="Drag to reorder">&#9776;</span>' +
        '<h3 class="admin__deliverable-label">Sub-group ' + count + '</h3>' +
        '<button type="button" class="admin__btn admin__btn--small admin__btn--danger" onclick="removeDeliverable(this)">Remove</button>' +
      '</div>' +
      '<div class="admin__form-grid">' +
        '<div class="admin__form-group admin__form-group--full">' +
          '<label>Title</label>' +
          '<input type="text" name="del_title" value="" />' +
        '</div>' +
        '<div class="admin__form-group admin__form-group--full">' +
          '<label>Subtitle</label>' +
          '<input type="text" name="del_subtitle" value="" placeholder="Optional line under the section title" />' +
        '</div>' +
        '<div class="admin__form-group admin__form-group--full">' +
          '<label>Description</label>' +
          '<textarea name="del_description" rows="2"></textarea>' +
        '</div>' +
        '<div class="admin__form-group">' +
          '<label>Grid columns</label>' +
          '<select name="del_gridColumns">' +
            '<option value="" selected>Auto</option>' +
            '<option value="1">1</option>' +
            '<option value="2">2</option>' +
            '<option value="3">3</option>' +
            '<option value="4">4</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="admin__media-section">' +
        '<div class="admin__section-header">' +
          '<h4>Media</h4>' +
          '<div>' +
            '<input type="file" accept="image/*,video/*" multiple onchange="uploadMedia(this)" style="display:none" />' +
            '<button type="button" class="admin__btn admin__btn--small" onclick="this.previousElementSibling.click()">Upload Files</button>' +
            '<button type="button" class="admin__btn admin__btn--small admin__btn--outline" onclick="addMediaManual(this)">+ Add Manually</button>' +
          '</div>' +
        '</div>' +
        '<div class="admin__media-grid"></div>' +
      '</div>' +
    '</div>';

  list.insertAdjacentHTML('beforeend', html);
  initDragAndDrop();
}

function removeDeliverable(btn) {
  if (!confirm('Remove this sub-group?')) return;
  btn.closest('.admin__deliverable').remove();
  renumberDeliverables();
}

function renumberDeliverables() {
  var items = document.querySelectorAll('.admin__deliverable');
  items.forEach(function (el, i) {
    var label = el.querySelector('.admin__deliverable-label');
    if (label) label.textContent = 'Sub-group ' + (i + 1);
  });
}

/* ─── Form submission ────────────────────────────────────────────────── */
var form = document.getElementById('entityForm');
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var entity = form.dataset.entity;
    var id = form.dataset.id;
    var isNew = form.dataset.isNew === 'true';

    var getValue = function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      if (!el) return '';
      if (el.type === 'checkbox') return el.checked;
      return el.value;
    };

    var payload = {
      title: getValue('title'),
      role: getValue('role'),
      dateRange: getValue('dateRange'),
      description: getValue('description'),
      logo: getValue('logo'),
      logoHover: getValue('logoHover'),
      subtitle: getValue('subtitle'),
      hidden: getValue('hidden'),
      projectType: getValue('projectType') === 'personal' ? 'personal' : 'client',
      order: parseInt(getValue('order'), 10) || 1,
      skills: [],
      deliverables: collectDeliverables()
    };

    var method = isNew ? 'POST' : 'PUT';
    var url = isNew ? '/api/' + entity : '/api/' + entity + '/' + id;

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Save failed');
        return res.json();
      })
      .then(function (data) {
        showToast('Saved successfully!', 'success');
        if (isNew) {
          setTimeout(function () {
            window.location.href = '/admin/' + entity + '/' + data.id + '/edit';
          }, 800);
        }
      })
      .catch(function () { showToast('Save failed', 'error'); });
  });
}

function collectDeliverables() {
  var deliverables = [];
  var blocks = document.querySelectorAll('.admin__deliverable');

  blocks.forEach(function (block) {
    var subEl = block.querySelector('[name="del_subtitle"]');
    var colsEl = block.querySelector('[name="del_gridColumns"]');
    var del = {
      id: block.dataset.delId || '',
      title: block.querySelector('[name="del_title"]').value,
      subtitle: subEl ? subEl.value : '',
      description: block.querySelector('[name="del_description"]').value,
      gridColumns: colsEl ? colsEl.value : '',
      media: []
    };

    var mediaItems = block.querySelectorAll('.admin__media-item');
    mediaItems.forEach(function (mi) {
      del.media.push({
        type: mi.querySelector('[name="media_type"]').value,
        src: mi.querySelector('[name="media_src"]').value,
        alt: mi.querySelector('[name="media_alt"]').value
      });
    });

    deliverables.push(del);
  });

  return deliverables;
}

/* ─── Drag-and-drop for deliverables ─────────────────────────────────── */
function initDragAndDrop() {
  var list = document.getElementById('deliverablesList');
  if (!list) return;

  var dragSrc = null;

  list.querySelectorAll('.admin__deliverable-drag').forEach(function (handle) {
    var item = handle.closest('.admin__deliverable');
    if (item.dataset.dragInit === '1') return;
    item.dataset.dragInit = '1';

    item.setAttribute('draggable', 'true');

    item.addEventListener('dragstart', function (e) {
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', function () {
      item.classList.remove('dragging');
      dragSrc = null;
      renumberDeliverables();
    });

    item.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    item.addEventListener('drop', function (e) {
      e.preventDefault();
      if (dragSrc && dragSrc !== item) {
        var parent = item.parentNode;
        var allItems = Array.from(parent.querySelectorAll('.admin__deliverable'));
        var fromIdx = allItems.indexOf(dragSrc);
        var toIdx = allItems.indexOf(item);

        if (fromIdx < toIdx) {
          parent.insertBefore(dragSrc, item.nextSibling);
        } else {
          parent.insertBefore(dragSrc, item);
        }
      }
    });
  });

  list.querySelectorAll('.admin__media-grid').forEach(function (grid) {
    initMediaDragAndDrop(grid);
  });
}

/* ─── Drag-and-drop for media items within a sub-group ───────────────── */
function initMediaDragAndDrop(grid) {
  if (!grid) return;
  var dragSrc = null;

  grid.querySelectorAll('.admin__media-item').forEach(function (item) {
    if (item.dataset.dragInit === '1') return;
    item.dataset.dragInit = '1';

    item.setAttribute('draggable', 'true');

    item.addEventListener('dragstart', function (e) {
      // Don't start drag when interacting with inputs/buttons
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') {
        e.preventDefault();
        return;
      }
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', function () {
      item.classList.remove('dragging');
      dragSrc = null;
    });

    item.addEventListener('dragover', function (e) {
      if (!dragSrc || dragSrc.parentNode !== grid) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    item.addEventListener('drop', function (e) {
      if (!dragSrc || dragSrc === item || dragSrc.parentNode !== grid) return;
      e.preventDefault();
      var allItems = Array.from(grid.querySelectorAll('.admin__media-item'));
      var fromIdx = allItems.indexOf(dragSrc);
      var toIdx = allItems.indexOf(item);
      if (fromIdx < toIdx) {
        grid.insertBefore(dragSrc, item.nextSibling);
      } else {
        grid.insertBefore(dragSrc, item);
      }
    });
  });
}

function isHeroVideoFile(file) {
  if (!file) return false;
  var name = (file.name || '').toLowerCase();
  var type = (file.type || '').toLowerCase();
  return (
    /\.(mp4|webm|mov|html?)$/.test(name) ||
    type.indexOf('video/') === 0 ||
    type === 'text/html' ||
    type === 'application/xhtml+xml'
  );
}

function deleteHeroVideo(variant) {
  var label = variant === 'mobile' ? 'mobile' : 'desktop';
  if (!confirm('Remove the ' + label + ' hero video from the server?')) return;
  fetch('/api/hero-video/' + encodeURIComponent(variant), { method: 'DELETE' })
    .then(function (res) {
      return res.json().then(function (j) {
        return { ok: res.ok, j: j };
      });
    })
    .then(function (o) {
      if (!o.ok) throw new Error((o.j && o.j.error) || 'Could not remove video');
      showToast(label.charAt(0).toUpperCase() + label.slice(1) + ' hero video removed', 'success');
      setTimeout(function () {
        location.reload();
      }, 400);
    })
    .catch(function (e) {
      showToast(e.message || 'Could not remove video', 'error');
    });
}

function initHeroVideoUploadForm(form) {
  var variant = form.getAttribute('data-hero-variant');
  if (variant !== 'desktop' && variant !== 'mobile') return;

  var suffix = variant === 'mobile' ? 'Mobile' : 'Desktop';
  var input = document.getElementById('heroVideoFile' + suffix);
  var submitBtn = document.getElementById('heroVideoSubmitBtn' + suffix);
  var fileNameEl = document.getElementById('heroVideoFileName' + suffix);
  var dropzone = document.getElementById('heroVideoDropzone' + suffix);
  if (!input) return;

  function setFileNameLabel(file) {
    if (!fileNameEl) return;
    if (file) {
      fileNameEl.textContent = file.name;
    } else {
      fileNameEl.innerHTML =
        '<span class="admin__resume-file-name__placeholder">No file selected</span>';
    }
  }

  function syncSubmit() {
    if (submitBtn) submitBtn.disabled = !(input.files && input.files[0]);
  }

  input.addEventListener('change', function () {
    setFileNameLabel(input.files && input.files[0]);
    syncSubmit();
  });

  if (dropzone) {
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('admin__resume-dropzone--active');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('admin__resume-dropzone--active');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (!isHeroVideoFile(f)) {
        showToast('Please choose an MP4, WebM, MOV, or HTML file.', 'error');
        return;
      }
      try {
        var dt = new DataTransfer();
        dt.items.add(f);
        input.files = dt.files;
      } catch (err) {
        return;
      }
      setFileNameLabel(f);
      syncSubmit();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = input.files && input.files[0];
    if (!f) {
      showToast('Choose a video or HTML file to upload.', 'error');
      return;
    }
    if (!isHeroVideoFile(f)) {
      showToast('Please choose an MP4, WebM, MOV, or HTML file.', 'error');
      return;
    }
    var fd = new FormData();
    fd.append('variant', variant);
    fd.append('video', f);
    if (submitBtn) submitBtn.disabled = true;
    fetch('/api/hero-video', { method: 'POST', body: fd })
      .then(function (res) {
        return res.json().then(function (j) {
          return { ok: res.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok) throw new Error((o.j && o.j.error) || 'Upload failed');
        showToast(
          (variant === 'mobile' ? 'Mobile' : 'Desktop') + ' hero video saved. Refresh the homepage.',
          'success'
        );
        setTimeout(function () {
          location.reload();
        }, 500);
      })
      .catch(function (err) {
        showToast(err.message || 'Upload failed', 'error');
      })
      .finally(function () {
        syncSubmit();
      });
  });
}

function initHeroVideoUpload() {
  document.querySelectorAll('.admin-dash__hero-video-form').forEach(initHeroVideoUploadForm);
}

function initAdminPortfolioFocusToggle() {
  var el = document.getElementById('adminPortfolioFocusToggle');
  if (!el) return;
  var KEY = 'portfolioHeroMarqueeFocus';
  try {
    el.checked = localStorage.getItem(KEY) === '1';
  } catch (e) {
    /* ignore */
  }
  el.addEventListener('change', function () {
    try {
      if (el.checked) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
      showToast(
        el.checked
          ? 'Saved. Refresh the homepage to see presentation view.'
          : 'Saved. Refresh the homepage to restore the full layout.',
        'success'
      );
    } catch (err) {
      showToast('Storage unavailable in this browser.', 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initDragAndDrop();
  initHeroVideoUpload();
  initAdminPortfolioFocusToggle();
});
