/*
 * Helper to determine ticket urgency based on the department and subject.
 *
 * The urgency of a ticket is not stored in the database; instead it is
 * derived from a catalog of predefined subjects for each department.
 * The front‑end uses `src/public/js/tickets_catalog.js` to populate the
 * dropdowns and show a badge when a ticket is being created.  On the
 * server side we need to replicate that logic in order to display the
 * computed urgency in listings and exports without persisting it.
 *
 * This module dynamically loads the catalog by evaluating the browser
 * script inside a sandbox and then exposes a simple function
 * `getUrgency(departmentName, subject)` which returns the urgency
 * associated with a given department and subject.  If no match is
 * found it returns `null`.  A second helper `getUrgencyOrDefault`
 * returns a default of `'MEDIA'` when no specific urgency exists.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let catalogCache = null;

function loadCatalog() {
  // If already loaded, reuse the cached catalog
  if (catalogCache) return catalogCache;
  // Read the browser catalog script.  It defines `window.TICKETS_CATALOGO`
  // which we capture inside a sandbox.
  const catalogPath = path.join(__dirname, '..', 'public', 'js', 'tickets_catalog.js');
  const code = fs.readFileSync(catalogPath, 'utf8');
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(code, sandbox, { filename: 'tickets_catalog.js' });
    const data = sandbox.window.TICKETS_CATALOGO || {};
    catalogCache = data;
    return data;
  } catch (e) {
    console.error('[urgency] Failed to load catalog:', e);
    catalogCache = {};
    return {};
  }
}

/**
 * Returns the urgency string (e.g. 'ALTA', 'MEDIA', 'BAJA') for a given
 * department and subject.  If no matching entry exists in the catalog
 * the function returns `null`.
 *
 * @param {string} departmentName Name of the department (case sensitive)
 * @param {string} subject Subject text to look up
 * @returns {string|null}
 */
function getUrgency(departmentName, subject) {
  if (!departmentName || !subject) return null;
  const catalog = loadCatalog();
  const list = catalog[departmentName] || [];
  // The matching is exact on subject; subjects in the catalog are stored
  // exactly as they appear in the front‑end dropdown.  Trim any whitespace.
  const s = String(subject).trim();
  const entry = list.find(it => String(it.subject || '').trim() === s);
  return entry ? entry.urgency : null;
}

/**
 * Same as `getUrgency` but returns `'MEDIA'` when no match is found.
 * This mirrors the front‑end behaviour which defaults to MEDIA when the
 * urgency cannot be determined.
 *
 * @param {string} departmentName
 * @param {string} subject
 * @returns {string}
 */
function getUrgencyOrDefault(departmentName, subject) {
  return getUrgency(departmentName, subject) || 'MEDIA';
}

module.exports = { getUrgency, getUrgencyOrDefault };