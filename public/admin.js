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

/* ─── Job CRM: status ─────────────────────────────────────────────────── */
function updateCrmJobStatus(selectEl) {
  var id = selectEl.getAttribute('data-id');
  var prev = '';
  try {
    prev = decodeURIComponent(selectEl.getAttribute('data-prev') || '');
  } catch (e) {
    prev = selectEl.getAttribute('data-prev') || '';
  }
  var next = selectEl.value;
  if (next === prev) return;
  fetch('/api/jobs-crm/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ st: next })
  })
    .then(function (res) {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(function () {
      selectEl.setAttribute('data-prev', encodeURIComponent(next));
      showToast('Status updated', 'success');
    })
    .catch(function () {
      showToast('Could not update status', 'error');
      selectEl.value = prev;
      if (selectEl.value !== prev) location.reload();
    });
}

function updateCrmJobYoe(inputEl) {
  var id = inputEl.getAttribute('data-id');
  var prev = '';
  try {
    prev = decodeURIComponent(inputEl.getAttribute('data-prev') || '');
  } catch (e) {
    prev = inputEl.getAttribute('data-prev') || '';
  }
  var next = inputEl.value.trim();
  if (next === prev) return;
  fetch('/api/jobs-crm/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yoe: next })
  })
    .then(function (res) {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(function () {
      inputEl.setAttribute('data-prev', encodeURIComponent(next));
      showToast('Years of experience updated', 'success');
    })
    .catch(function () {
      showToast('Could not save years of experience', 'error');
      try {
        inputEl.value = decodeURIComponent(inputEl.getAttribute('data-prev') || '');
      } catch (e2) {
        inputEl.value = '';
      }
    });
}

function updateCrmJobNotes(textareaEl) {
  var id = textareaEl.getAttribute('data-id');
  var prev = '';
  try {
    prev = decodeURIComponent(textareaEl.getAttribute('data-prev') || '');
  } catch (e) {
    prev = textareaEl.getAttribute('data-prev') || '';
  }
  var next = textareaEl.value.trim();
  if (next === prev) return;
  fetch('/api/jobs-crm/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: next })
  })
    .then(function (res) {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(function () {
      textareaEl.setAttribute('data-prev', encodeURIComponent(next));
      showToast('Job details saved', 'success');
    })
    .catch(function () {
      showToast('Could not save job details', 'error');
      try {
        textareaEl.value = decodeURIComponent(textareaEl.getAttribute('data-prev') || '');
      } catch (e2) {
        textareaEl.value = '';
      }
    });
}

function updateCrmJobDeadline(inputEl) {
  var id = inputEl.getAttribute('data-id');
  var prev = '';
  try {
    prev = decodeURIComponent(inputEl.getAttribute('data-prev') || '');
  } catch (e) {
    prev = inputEl.getAttribute('data-prev') || '';
  }
  var next = inputEl.value.trim();
  if (next === prev) return;
  fetch('/api/jobs-crm/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deadline: next })
  })
    .then(function (res) {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(function () {
      inputEl.setAttribute('data-prev', encodeURIComponent(next));
      showToast('Deadline updated', 'success');
    })
    .catch(function () {
      showToast('Could not save deadline', 'error');
      try {
        inputEl.value = decodeURIComponent(inputEl.getAttribute('data-prev') || '');
      } catch (e2) {
        inputEl.value = '';
      }
    });
}

function updateCrmJobPriority(selectEl) {
  var id = selectEl.getAttribute('data-id');
  var prev = '';
  try {
    prev = decodeURIComponent(selectEl.getAttribute('data-prev') || '');
  } catch (e) {
    prev = selectEl.getAttribute('data-prev') || '';
  }
  var next = selectEl.value;
  if (next === prev) return;
  fetch('/api/jobs-crm/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pri: next })
  })
    .then(function (res) {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(function () {
      selectEl.setAttribute('data-prev', encodeURIComponent(next));
      var row = selectEl.closest('tr');
      if (row) row.setAttribute('data-pri', next);
      var pc = ['high', 'medium', 'low'].indexOf(next.toLowerCase()) >= 0 ? next.toLowerCase() : 'other';
      selectEl.className = 'admin__job-priority admin__job-priority--' + pc;
      showToast('Priority updated', 'success');
    })
    .catch(function () {
      showToast('Could not update priority', 'error');
      selectEl.value = prev;
      if (selectEl.value !== prev) location.reload();
    });
}

/* ─── Job CRM: star / remove ──────────────────────────────────────────── */
function toggleJobStar(btn) {
  var id = btn.getAttribute('data-id');
  var wasStarred = btn.getAttribute('data-starred') === '1';
  fetch('/api/jobs-crm/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ starred: !wasStarred })
  })
    .then(function (res) {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(function () {
      showToast(wasStarred ? 'Removed from starred' : 'Starred', 'success');
      setTimeout(function () { location.reload(); }, 400);
    })
    .catch(function () { showToast('Could not update star', 'error'); });
}

function downloadJobCoverLetter(id) {
  fetch('/api/jobs-crm/' + encodeURIComponent(id) + '/cover-letter')
    .then(function (res) {
      if (!res.ok) throw new Error();
      var disposition = res.headers.get('Content-Disposition') || '';
      var m = /filename="([^"]+)"/.exec(disposition);
      var fname = m && m[1] ? m[1] : 'cover-letter.docx';
      return res.blob().then(function (blob) {
        return { fname: fname, blob: blob };
      });
    })
    .then(function (o) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(o.blob);
      a.download = o.fname;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      showToast('Cover letter downloaded', 'success');
    })
    .catch(function () {
      showToast('Could not generate cover letter', 'error');
    });
}

/* ─── Job Hunter (Claude skill: skills/job-hunter) ───────────────────── */
var JOB_HUNTER_US_STATES = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming']
];

function initJobHunterCriteriaForm() {
  var sel = document.getElementById('job-hunter-state');
  if (!sel || sel.querySelector('option[value="AL"]')) return;
  JOB_HUNTER_US_STATES.forEach(function (pair) {
    var opt = document.createElement('option');
    opt.value = pair[0];
    opt.textContent = pair[1];
    sel.appendChild(opt);
  });
}

var JOB_HUNTER_YOE_LABELS = {
  any: 'Any level',
  entry: 'Entry-level (about 0–1 years)',
  '1-3': 'About 1–3 years',
  '3-5': 'About 3–5 years',
  '5-8': 'About 5–8 years',
  '8+': 'About 8+ years'
};

var JOB_HUNTER_WORK_LABELS = {
  any: 'No preference (remote, hybrid, or on-site)',
  remote: 'Remote only',
  hybrid: 'Hybrid only',
  onsite: 'On-site / in-person only',
  'remote-hybrid': 'Remote or hybrid (exclude fully on-site)'
};

function buildJobHunterStructuredCriteria() {
  var lines = ['Structured search criteria (apply all that are set):'];
  var roleEl = document.getElementById('job-hunter-role-title');
  var role = roleEl ? String(roleEl.value || '').trim() : '';
  if (role) {
    lines.push('- Role title / focus: ' + role);
  }
  var stEl = document.getElementById('job-hunter-state');
  var st = stEl ? String(stEl.value || '').trim() : '';
  if (st) {
    var label = '';
    for (var i = 0; i < JOB_HUNTER_US_STATES.length; i++) {
      if (JOB_HUNTER_US_STATES[i][0] === st) {
        label = JOB_HUNTER_US_STATES[i][1];
        break;
      }
    }
    lines.push('- Location: US state = ' + (label || st) + ' (include jobs in or tied to this state).');
  }
  var yoeEl = document.getElementById('job-hunter-yoe');
  var yoe = yoeEl ? String(yoeEl.value || 'any') : 'any';
  if (yoe !== 'any') {
    lines.push('- Years of experience: prefer postings that match ' + (JOB_HUNTER_YOE_LABELS[yoe] || yoe) + '.');
  }
  var workEl = document.getElementById('job-hunter-work');
  var work = workEl ? String(workEl.value || 'any') : 'any';
  if (work !== 'any') {
    lines.push('- Work arrangement: ' + (JOB_HUNTER_WORK_LABELS[work] || work) + '.');
  }
  var incEl = document.getElementById('job-hunter-include-internships');
  var includeIntern = incEl && incEl.checked;
  lines.push(
    includeIntern
      ? '- Internships: Include internship roles when relevant.'
      : '- Internships: Exclude internship-only roles; prioritize full-time and experienced-hire postings.'
  );
  return lines.join('\n');
}

function jobHunterFormHasIntent() {
  var qEl = document.getElementById('job-hunter-query');
  if (qEl && String(qEl.value || '').trim()) return true;
  var roleEl = document.getElementById('job-hunter-role-title');
  if (roleEl && String(roleEl.value || '').trim()) return true;
  var ta = document.getElementById('job-hunter-criteria');
  if (ta && String(ta.value || '').trim()) return true;
  var stEl = document.getElementById('job-hunter-state');
  if (stEl && String(stEl.value || '').trim()) return true;
  var yoeEl = document.getElementById('job-hunter-yoe');
  if (yoeEl && yoeEl.value && yoeEl.value !== 'any') return true;
  var workEl = document.getElementById('job-hunter-work');
  if (workEl && workEl.value && workEl.value !== 'any') return true;
  var incEl = document.getElementById('job-hunter-include-internships');
  if (incEl && incEl.checked) return true;
  return false;
}

function parseTagsCell(tagsStr) {
  if (!tagsStr || String(tagsStr).trim() === '' || String(tagsStr).trim() === '—') return [];
  return String(tagsStr)
    .split(',')
    .map(function (t) {
      return t.trim();
    })
    .filter(Boolean)
    .slice(0, 16);
}

function jobHunterPriorityClass(pri) {
  var p = String(pri || 'Medium')
    .trim()
    .toLowerCase();
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  return 'other';
}

function isListingUrl(s) {
  return /^https?:\/\//i.test(String(s || '').trim());
}

/** Render CRM-shaped table from server JSON (openRoles); optional collapsible raw model text. */
function renderJobHunterOutput(container, data) {
  container.innerHTML = '';
  var roles = data.openRoles || [];
  var text = data.text || '';

  var heading = document.createElement('h4');
  heading.className = 'admin__job-hunter__results-heading';
  heading.textContent = 'Results';
  container.appendChild(heading);

  if (roles.length) {
    var wrap = document.createElement('div');
    wrap.className = 'admin__job-hunter__table-wrap admin__jobs-wrap';
    var cap = document.createElement('p');
    cap.className = 'admin__job-hunter__table-caption';
    cap.innerHTML =
      'Open roles <span class="admin__text-muted">(from parsed search results — verify listings before applying). Rows with a left border were flagged by an automatic double-check—hover the row for details.</span>';
    wrap.appendChild(cap);

    var table = document.createElement('table');
    table.className = 'admin__jobs-table admin__jobs-table--hunter';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    [
      '#',
      'Company',
      'Role',
      'Yrs exp',
      'Job details',
      'Location',
      'Deadline',
      'Status',
      'Priority',
      'Tags',
      'Listing'
    ].forEach(function (label) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    for (var i = 0; i < roles.length; i++) {
      var r = roles[i];
      var tr = document.createElement('tr');
      var url = (r.url || '').trim();

      var numEl = document.createElement('td');
      numEl.className = 'admin__jobs-num';
      numEl.textContent = r.idx != null && String(r.idx) !== '' ? String(r.idx) : String(i + 1);
      tr.appendChild(numEl);

      var coEl = document.createElement('td');
      coEl.className = 'admin__jobs-co';
      coEl.textContent = r.co || '';
      tr.appendChild(coEl);

      var roleWrap = document.createElement('td');
      var roleDiv = document.createElement('div');
      roleDiv.className = 'admin__jobs-role';
      roleDiv.textContent = r.role || '';
      roleWrap.appendChild(roleDiv);
      tr.appendChild(roleWrap);

      var yoeEl = document.createElement('td');
      yoeEl.className = 'admin__jobs-yoe-cell';
      yoeEl.textContent = r.yoe || '';
      tr.appendChild(yoeEl);

      var det = document.createElement('td');
      det.className = 'admin__jobs-details-cell admin__job-hunter__cell-details';
      det.textContent = r.notes || '';
      tr.appendChild(det);

      var locEl = document.createElement('td');
      locEl.textContent = r.loc || '';
      tr.appendChild(locEl);

      var dlEl = document.createElement('td');
      dlEl.className = 'admin__jobs-deadline-cell';
      dlEl.textContent = r.deadline || '';
      tr.appendChild(dlEl);

      var stEl = document.createElement('td');
      stEl.textContent = r.st || '';
      tr.appendChild(stEl);

      var priTd = document.createElement('td');
      var priSpan = document.createElement('span');
      priSpan.className =
        'admin__job-priority admin__job-priority--' + jobHunterPriorityClass(r.pri);
      priSpan.textContent = r.pri || '';
      priTd.appendChild(priSpan);
      tr.appendChild(priTd);

      var tagsTd = document.createElement('td');
      var tagsDiv = document.createElement('div');
      tagsDiv.className = 'admin__jobs-tags';
      parseTagsCell(r.tags).forEach(function (tag) {
        var sp = document.createElement('span');
        sp.className = 'admin__tag';
        sp.textContent = tag;
        tagsDiv.appendChild(sp);
      });
      if (!tagsDiv.childNodes.length && String(r.tags || '').trim() === '—') {
        var tagDash = document.createElement('span');
        tagDash.className = 'admin__text-muted';
        tagDash.textContent = '—';
        tagsDiv.appendChild(tagDash);
      }
      tagsTd.appendChild(tagsDiv);
      tr.appendChild(tagsTd);

      var listTd = document.createElement('td');
      listTd.className = 'admin__jobs-listing-cell';
      if (isListingUrl(url)) {
        var a = document.createElement('a');
        a.href = url;
        a.className = 'admin__btn admin__btn--small admin__btn--outline admin__btn--icon';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', 'Open job listing');
        a.innerHTML =
          '<svg class="admin__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        listTd.appendChild(a);
      } else if (url && url !== '—') {
        var muted = document.createElement('span');
        muted.className = 'admin__text-muted';
        muted.textContent = url;
        listTd.appendChild(muted);
      } else {
        listTd.innerHTML = '<span class="admin__text-muted">—</span>';
      }
      tr.appendChild(listTd);

      if (r.verificationIssues && r.verificationIssues.length) {
        tr.classList.add('admin__job-hunter__row--review');
        tr.title = r.verificationIssues.join(' ');
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  } else {
    var empty = document.createElement('p');
    empty.className = 'admin__text-muted admin__job-hunter__empty-results';
    empty.textContent =
      'No job rows were parsed into the table. Expand “Full model output” below if the model returned text, or try different keywords.';
    container.appendChild(empty);
  }

  if (text && String(text).trim()) {
    var details = document.createElement('details');
    details.className = 'admin__job-hunter__details';
    var sum = document.createElement('summary');
    sum.className = 'admin__job-hunter__details-summary';
    sum.textContent = roles.length ? 'Full model output (optional)' : 'Model output';
    details.appendChild(sum);
    var pre = document.createElement('pre');
    pre.className = 'admin__job-hunter__report admin__job-hunter__report--secondary';
    pre.textContent = text;
    details.appendChild(pre);
    container.appendChild(details);
  }
}

function runJobHunterSkillSearch() {
  var qEl = document.getElementById('job-hunter-query');
  var ta = document.getElementById('job-hunter-criteria');
  var countEl = document.getElementById('job-hunter-count');
  var statusEl = document.getElementById('job-hunter-status');
  var outEl = document.getElementById('job-hunter-output');
  var btn = document.getElementById('job-hunter-run');
  var searchQuery = qEl ? qEl.value.trim() : '';
  var notes = ta ? ta.value.trim() : '';
  var structured = buildJobHunterStructuredCriteria();
  var criteria = structured;
  if (notes) {
    criteria += '\n\nAdditional notes:\n' + notes;
  }
  var rawCount = countEl ? parseInt(String(countEl.value), 10) : 8;
  var targetJobCount = Number.isNaN(rawCount) ? 8 : Math.min(25, Math.max(1, rawCount));
  if (!jobHunterFormHasIntent()) {
    showToast('Add a search query and/or at least one criterion (role, state, experience, work style, internships, or notes)', 'error');
    return;
  }
  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.hidden = false;
    statusEl.className = 'admin__job-hunter__status admin__job-hunter__status--busy';
    statusEl.textContent = 'Calling Claude with the Job Hunter skill…';
  }
  if (outEl) {
    outEl.hidden = true;
    outEl.innerHTML = '';
  }
  fetch('/api/job-hunter/find-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchQuery: searchQuery,
      criteria: criteria,
      targetJobCount: targetJobCount
    })
  })
    .then(function (res) {
      return res.json().then(function (j) {
        return { ok: res.ok, j: j };
      });
    })
    .then(function (o) {
      if (!o.ok) throw new Error((o.j && o.j.error) || 'Request failed');
      if (outEl) {
        outEl.hidden = false;
        renderJobHunterOutput(outEl, o.j);
      }
      if (statusEl) {
        var doneParts = [];
        if (o.j.model) doneParts.push(o.j.model);
        if (typeof o.j.targetJobCount === 'number') doneParts.push('target ' + o.j.targetJobCount + ' roles');
        var cs = o.j.crmSave;
        if (cs && typeof cs.added === 'number' && cs.added > 0) {
          doneParts.push('saved ' + cs.added + ' to Job CRM');
        } else if (cs && cs.error) {
          doneParts.push('CRM save failed');
        }
        statusEl.className = 'admin__job-hunter__status admin__job-hunter__status--done';
        statusEl.textContent = doneParts.length ? 'Done · ' + doneParts.join(' · ') : 'Done';
      }
      var toastMsg = 'Job Hunter results ready';
      if (o.j.crmSave && typeof o.j.crmSave.added === 'number' && o.j.crmSave.added > 0) {
        toastMsg +=
          ' · ' + o.j.crmSave.added + ' new job(s) saved to your list — refresh the page to see them in Job CRM.';
      } else if (o.j.crmSave && o.j.crmSave.error) {
        toastMsg += ' (could not save to CRM — check server logs)';
      }
      showToast(toastMsg, 'success');
    })
    .catch(function (e) {
      showToast(e.message || 'Job Hunter failed', 'error');
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.className = 'admin__job-hunter__status admin__job-hunter__status--err';
        statusEl.textContent = e.message || 'Error';
      }
    })
    .finally(function () {
      if (btn) btn.disabled = false;
    });
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

function deleteAllJobsCrm() {
  if (!confirm('Remove ALL jobs from the CRM? This cannot be undone.')) return;
  fetch('/api/jobs-crm', { method: 'DELETE' })
    .then(function (res) {
      return res.json().then(function (j) {
        return { ok: res.ok, j: j };
      });
    })
    .then(function (o) {
      if (!o.ok) throw new Error((o.j && o.j.error) || 'Request failed');
      var n = o.j && typeof o.j.removed === 'number' ? o.j.removed : 0;
      showToast('Removed ' + n + ' job(s)', 'success');
      setTimeout(function () {
        location.reload();
      }, 400);
    })
    .catch(function (e) {
      showToast(e.message || 'Remove all failed', 'error');
    });
}

function deleteJobCrm(id) {
  if (!confirm('Remove this job from your CRM list? This cannot be undone.')) return;
  fetch('/api/jobs-crm/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function (res) {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(function () {
      showToast('Job removed from CRM', 'success');
      setTimeout(function () { location.reload(); }, 500);
    })
    .catch(function () { showToast('Remove failed', 'error'); });
}

/* ─── Delete item from dashboard ──────────────────────────────────────── */
function deleteItem(entity, id) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  fetch('/api/' + entity + '/' + id, { method: 'DELETE' })
    .then(function (res) { return res.json(); })
    .then(function () {
      showToast('Deleted successfully', 'success');
      setTimeout(function () { location.reload(); }, 500);
    })
    .catch(function () { showToast('Delete failed', 'error'); });
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
}

/* ─── Add deliverable sub-group ──────────────────────────────────────── */
function addDeliverable() {
  var list = document.getElementById('deliverablesList');
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
          '<label>Description</label>' +
          '<textarea name="del_description" rows="2"></textarea>' +
        '</div>' +
        '<div class="admin__form-group">' +
          '<label>Gallery CSS Class (optional)</label>' +
          '<input type="text" name="del_galleryClass" value="" />' +
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
      sectionLabel: getValue('sectionLabel'),
      headerStyle: getValue('headerStyle'),
      type: getValue('type'),
      role: getValue('role'),
      company: getValue('company'),
      dateRange: getValue('dateRange'),
      description: getValue('description'),
      logo: getValue('logo'),
      subtitle: getValue('subtitle'),
      meta: getValue('meta'),
      tileClass: getValue('tileClass'),
      hidden: getValue('hidden'),
      logoWide: getValue('logoWide'),
      order: parseInt(getValue('order'), 10) || 1,
      skills: getValue('skills')
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean),
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
    var del = {
      id: block.dataset.delId || '',
      title: block.querySelector('[name="del_title"]').value,
      description: block.querySelector('[name="del_description"]').value,
      galleryClass: block.querySelector('[name="del_galleryClass"]').value,
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
}

/* ─── Job CRM: search + filters ─────────────────────────────────────── */
function initJobCrmSearch() {
  var input = document.getElementById('job-crm-search');
  var tbody = document.getElementById('job-crm-tbody');
  var countEl = document.getElementById('job-crm-search-count');
  if (!tbody) return;

  var rows = tbody.querySelectorAll('tr');
  var total = rows.length;

  var fPri = document.getElementById('job-crm-filter-pri');
  var fSt = document.getElementById('job-crm-filter-st');
  var fStar = document.getElementById('job-crm-filter-star');
  var fRegion = document.getElementById('job-crm-filter-region');
  var fTrack = document.getElementById('job-crm-filter-track');

  function hayFor(tr) {
    var raw = tr.getAttribute('data-job-crm-search') || '';
    try {
      return decodeURIComponent(raw).toLowerCase();
    } catch (e) {
      return raw.toLowerCase();
    }
  }

  function apply() {
    var q = input ? input.value.trim().toLowerCase() : '';
    var terms = q.split(/\s+/).filter(Boolean);
    var pri = fPri ? fPri.value : 'all';
    var st = fSt ? fSt.value : 'all';
    var star = fStar ? fStar.value : 'all';
    var region = fRegion ? fRegion.value : 'all';
    var track = fTrack ? fTrack.value : 'all';

    var visible = 0;
    rows.forEach(function (tr) {
      var hay = hayFor(tr);
      var okSearch = !terms.length || terms.every(function (t) {
        return hay.indexOf(t) !== -1;
      });

      var rowPri = tr.getAttribute('data-pri') || '';
      var okPri = pri === 'all' || rowPri === pri;

      var rowSt = tr.getAttribute('data-st') || '';
      var okSt = st === 'all' || rowSt === st;

      var rowStar = tr.getAttribute('data-starred') === '1';
      var okStar = star === 'all' ||
        (star === 'starred' && rowStar) ||
        (star === 'unstarred' && !rowStar);

      var rowReg = tr.getAttribute('data-region') || '';
      var okReg = region === 'all' || rowReg === region;

      var tracksStr = tr.getAttribute('data-tracks') || '';
      var okTrack = track === 'all' ||
        (track === 'unclassified' && tracksStr.indexOf('unclassified') !== -1) ||
        (track !== 'all' && track !== 'unclassified' && tracksStr.split(/\s+/).indexOf(track) !== -1);

      var show = okSearch && okPri && okSt && okStar && okReg && okTrack;
      tr.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (countEl) {
      var anyFilter = (pri !== 'all') || (st !== 'all') || (star !== 'all') || (region !== 'all') || (track !== 'all');
      if (!q && !anyFilter) {
        countEl.textContent = '';
      } else {
        countEl.textContent = visible + ' of ' + total;
      }
    }
  }

  if (input) {
    input.addEventListener('input', apply);
    input.addEventListener('search', apply);
  }
  [fPri, fSt, fStar, fRegion, fTrack].forEach(function (el) {
    if (el) el.addEventListener('change', apply);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initDragAndDrop();
  initJobCrmSearch();
  initJobHunterCriteriaForm();
});
