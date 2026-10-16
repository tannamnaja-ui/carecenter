/**
 * ชั้นอ่าน/เขียน Google Sheets
 * - อ่านหัวคอลัมน์จากแถว 3 (ชื่อฟิลด์) ข้อมูลเริ่มแถว 4
 * - ไม่เขียนทับเซลล์ที่มีสูตร และไม่แตะคอลัมน์ที่ใช้ ARRAYFORMULA
 */

let ss_ = null;
const headerCache_ = {};
const arrayFormulaColsCache_ = {};

function ss() {
  if (!ss_) ss_ = CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActive();
  return ss_;
}

function getSheet_(name) {
  const sh = findSheet_(ss(), name);
  if (!sh) throw new Error('ไม่พบแผ่นงาน "' + name + '" กรุณารันเมนู "ติดตั้ง/ตรวจสอบโครงสร้างแผ่นงาน" ก่อน');
  return sh;
}

/**
 * หาแผ่นงาน: 1) ชื่อปัจจุบัน 2) ชื่อเดิมใน SHEET_ALIASES
 * 3) แผ่นใดก็ได้ที่แถว 3 มีชื่อฟิลด์ตรงกับโครงสร้าง (กรณีมีคนเปลี่ยนชื่อแท็บเอง)
 */
function findSheet_(book, name) {
  const sh = book.getSheetByName(name);
  if (sh) return sh;
  const old = (SHEET_ALIASES[name] || []).map(n => book.getSheetByName(n)).filter(Boolean)[0];
  if (old) return old;
  const schema = SCHEMA[name];
  if (!schema) return null;
  const fields = schema.fields.filter(f => !(f[2] && f[2].extra)).map(f => f[0]);
  return book.getSheets().find(s => {
    if (s.getLastColumn() === 0 || s.getLastRow() < CONFIG.HEADER_ROW) return false;
    const headers = s.getRange(CONFIG.HEADER_ROW, 1, 1, s.getLastColumn()).getValues()[0].map(h => String(h).trim());
    return headers.indexOf(schema.idField) >= 0 && fields.filter(f => headers.indexOf(f) >= 0).length >= Math.min(4, fields.length);
  }) || null;
}

function getHeaders_(sh) {
  const name = sh.getName();
  if (headerCache_[name]) return headerCache_[name];
  const lastCol = sh.getLastColumn();
  const headers = lastCol === 0 ? [] :
    sh.getRange(CONFIG.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  headerCache_[name] = headers;
  return headers;
}

function resetCaches_() {
  Object.keys(headerCache_).forEach(k => delete headerCache_[k]);
  Object.keys(arrayFormulaColsCache_).forEach(k => delete arrayFormulaColsCache_[k]);
}

function getArrayFormulaCols_(sh) {
  const name = sh.getName();
  if (arrayFormulaColsCache_[name]) return arrayFormulaColsCache_[name];
  const lastCol = sh.getLastColumn();
  const cols = {};
  if (lastCol > 0) {
    const formulas = sh.getRange(CONFIG.HEADER_ROW, 1, CONFIG.DATA_START_ROW - CONFIG.HEADER_ROW + 1, lastCol).getFormulas();
    formulas.forEach(row => row.forEach((f, c) => { if (/ARRAYFORMULA/i.test(f)) cols[c] = true; }));
  }
  arrayFormulaColsCache_[name] = cols;
  return cols;
}

/** อ่านทั้งตารางเป็น array ของ object (ข้ามแถวที่ไม่มีรหัส) */
function readTable_(name) {
  const sh = getSheet_(name);
  const headers = getHeaders_(sh);
  const lastRow = sh.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW || !headers.length) return [];
  const values = sh.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, headers.length).getValues();
  const keyIdx = headers.indexOf(SCHEMA[name].idField);
  const rows = [];
  values.forEach((r, i) => {
    if (keyIdx >= 0 && String(r[keyIdx]).trim() === '') return;
    const obj = { _row: CONFIG.DATA_START_ROW + i };
    headers.forEach((h, c) => { if (h) obj[h] = typeof r[c] === 'string' ? r[c].trim() : r[c]; });
    rows.push(obj);
  });
  return rows;
}

function findById_(name, id) {
  const key = SCHEMA[name].idField;
  const target = String(id || '').trim().toUpperCase();
  if (!target) return null;
  return readTable_(name).find(r => String(r[key]).trim().toUpperCase() === target) || null;
}

function nextId_(name, rows) {
  const schema = SCHEMA[name];
  const pad = schema.idPad || 3;
  let max = 0;
  (rows || readTable_(name)).forEach(r => {
    const m = String(r[schema.idField]).match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return schema.idPrefix + String(max + 1).padStart(pad, '0');
}

function insertRow_(name, obj) {
  const sh = getSheet_(name);
  const headers = getHeaders_(sh);
  const keyCol = headers.indexOf(SCHEMA[name].idField) + 1;
  if (keyCol < 1) throw new Error('แผ่นงาน ' + name + ' ไม่มีคอลัมน์ ' + SCHEMA[name].idField + ' ในแถวที่ ' + CONFIG.HEADER_ROW);
  const row = findFirstEmptyRow_(sh, keyCol);
  writeRow_(sh, headers, row, obj);
  return row;
}

function updateRow_(name, id, patch) {
  const existing = findById_(name, id);
  if (!existing) throw new Error('ไม่พบรหัส ' + id + ' ใน ' + name);
  const sh = getSheet_(name);
  writeRow_(sh, getHeaders_(sh), existing._row, patch);
  return Object.assign({}, existing, patch);
}

function findFirstEmptyRow_(sh, keyCol) {
  const lastRow = Math.max(sh.getLastRow(), CONFIG.DATA_START_ROW);
  const vals = sh.getRange(CONFIG.DATA_START_ROW, keyCol, lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === '') return CONFIG.DATA_START_ROW + i;
  }
  return lastRow + 1;
}

/** เขียนทั้งแถวครั้งเดียว โดยคงสูตรเดิมไว้ */
function writeRow_(sh, headers, row, obj) {
  const range = sh.getRange(row, 1, 1, headers.length);
  const values = range.getValues()[0];
  const formulas = range.getFormulas()[0];
  const arrayCols = getArrayFormulaCols_(sh);
  const out = headers.map((h, c) => {
    if (formulas[c]) return formulas[c];
    if (arrayCols[c]) return values[c];
    if (h && Object.prototype.hasOwnProperty.call(obj, h) && h !== '_row') return obj[h];
    return values[c];
  });
  // เซลล์ใต้ ARRAYFORMULA ต้องว่างไว้ ไม่งั้นสูตรจะ #REF!
  const hasArray = Object.keys(arrayCols).length > 0;
  if (!hasArray) {
    range.setValues([out]);
  } else {
    headers.forEach((h, c) => {
      if (arrayCols[c] || formulas[c]) return;
      if (h && Object.prototype.hasOwnProperty.call(obj, h)) sh.getRange(row, c + 1).setValue(obj[h]);
    });
  }
}

/* ---------- แปลงค่า ---------- */

function toBool_(v) {
  if (v === true) return true;
  const s = String(v || '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'มี', 'มีรถ', '✓', '✔'].indexOf(s) >= 0;
}

function toNum_(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v || '').replace(/[,฿\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function digits_(v) {
  return String(v || '').replace(/\D/g, '');
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === "[object Date]";
}

/** รับ Date / "yyyy-MM-ddTHH:mm" / "yyyy-MM-dd" / "d/M/yyyy HH:mm" (รองรับปี พ.ศ.) */
function toDate_(v) {
  if (isDate_(v)) return isNaN(v.getTime()) ? null : v;
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) return makeDate_(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (m) return makeDate_(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0));
  return null;
}

function makeDate_(y, mo, d, h, mi) {
  if (y > 2400) y -= 543;
  const str = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') + ' ' +
    String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  return Utilities.parseDate(str, CONFIG.TZ, 'yyyy-MM-dd HH:mm');
}

/** เลขวันแบบนับตามเวลาไทย ใช้คำนวณส่วนต่างวัน */
function dayNumber_(d) {
  const s = Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd').split('-');
  return Math.round(Date.UTC(+s[0], +s[1] - 1, +s[2]) / 86400000);
}

function startOfDay_(d) {
  return makeDate_(+Utilities.formatDate(d, CONFIG.TZ, 'yyyy'), +Utilities.formatDate(d, CONFIG.TZ, 'M'),
    +Utilities.formatDate(d, CONFIG.TZ, 'd'), 0, 0);
}

function endOfDay_(d) {
  return new Date(startOfDay_(d).getTime() + 86400000 - 1);
}

/** วันที่แบบไทยสำหรับข้อความ LINE เช่น 20/10/2569 08:00 */
function fmtThai_(d, withTime) {
  d = toDate_(d);
  if (!d) return '-';
  const y = Number(Utilities.formatDate(d, CONFIG.TZ, 'yyyy')) + 543;
  return Utilities.formatDate(d, CONFIG.TZ, 'dd/MM/') + y + (withTime === false ? '' : Utilities.formatDate(d, CONFIG.TZ, ' HH:mm') + ' น.');
}

/** แปลงแถวให้ส่งกลับ google.script.run ได้ (Date ส่งข้ามไม่ได้) */
function serialize_(obj) {
  const out = {};
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    out[k] = isDate_(v) ? Utilities.formatDate(v, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm") : v;
  });
  return out;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('ระบบกำลังบันทึกข้อมูลอื่นอยู่ กรุณาลองใหม่อีกครั้ง');
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    // ข้อมูลเปลี่ยน → ล้างข้อมูลหน้าเว็บจองบริการที่ cache ไว้ (วันว่าง/งานที่ให้บริการอยู่)
    try { CacheService.getScriptCache().remove('public_site'); } catch (e) { /* ไม่เป็นไร */ }
    lock.releaseLock();
  }
}
