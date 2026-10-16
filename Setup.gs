/**
 * เมนูใน Google Sheets + ติดตั้งโครงสร้าง / ทริกเกอร์
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💗 ศูนย์ดวงใจกตัญญู')
    .addItem('1) ติดตั้ง/ตรวจสอบโครงสร้างแผ่นงาน', 'setupSheets')
    .addItem('2) เปิดแจ้งเตือนล่วงหน้า 24 ชม. (ทริกเกอร์)', 'installTriggers')
    .addItem('3) ทดสอบส่ง LINE ถึงศูนย์', 'testLine')
    .addSeparator()
    .addItem('ลิงก์ระบบ (ผู้จัดการ / จองงาน / ยื่นลา)', 'showWebAppLinks')
    .addItem('ส่งแจ้งเตือนงานพรุ่งนี้ตอนนี้เลย', 'sendUpcomingReminders')
    .addToUi();
}

// เป็นฟังก์ชัน (ไม่ใช่ const) เพราะลำดับโหลดไฟล์ .gs ไม่แน่นอน — OPTIONS อยู่ใน Config.gs
function validationRules_() {
  return {
    [SHEET.WORKERS]: { police_check_status: OPTIONS.police_check_status, status: OPTIONS.worker_status },
    [SHEET.CLIENTS]: { patient_condition: OPTIONS.patient_condition },
    [SHEET.SERVICES]: { unit_type: OPTIONS.unit_type },
    [SHEET.JOBS]: { payment_status: OPTIONS.payment_status, job_status: OPTIONS.job_status },
    [SHEET.PAYMENTS]: { trans_type: OPTIONS.trans_type, payout_status: OPTIONS.payout_status },
    [SHEET.LEAVES]: { status: OPTIONS.leave_status },
  };
}

const TEXT_COLUMNS_ = ['id_card_no', 'phone_number', 'client_phone'];
const DATE_COLUMNS_ = ['contract_signed_date', 'created_date', 'request_date', 'leave_start_date', 'leave_end_date'];
const DATETIME_COLUMNS_ = ['start_datetime', 'end_datetime', 'trans_datetime'];
const MONEY_COLUMNS_ = ['client_price', 'center_fee', 'worker_wage', 'total_client_amount', 'total_center_fee', 'total_worker_wage', 'amount'];

function setupSheets() {
  const book = ss();
  const report = [];

  Object.keys(SCHEMA).forEach(name => {
    const schema = SCHEMA[name];
    let sh = findSheet_(book, name);
    if (sh && sh.getName() !== name) {
      // เปลี่ยนชื่อแผ่นเดิม (ข้อมูลอยู่ครบ และสูตรที่อ้างถึงจะเปลี่ยนชื่อตามอัตโนมัติ)
      report.push('✏️ เปลี่ยนชื่อแผ่นงาน "' + sh.getName() + '" เป็น "' + name + '"');
      sh.setName(name);
    }
    if (!sh) {
      sh = book.insertSheet(name);
      buildNewSheet_(sh, schema);
      report.push('➕ สร้างแผ่นงาน ' + name);
    } else {
      const added = appendMissingColumns_(sh, schema);
      if (added.length) report.push('➕ ' + name + ': เพิ่มคอลัมน์ ' + added.join(', '));
    }
    applyValidation_(sh, name);
  });

  resetCaches_();
  if (seedAboutSheet_()) report.push('📝 ใส่ข้อความตั้งต้นในแผ่น "' + SHEET.ABOUT + '" แล้ว (แก้ไขได้ในชีต)');

  applyConditionalFormats_(book);
  if (!book.getSheetByName(SHEET.DASHBOARD)) {
    buildDashboardSheet_(book);
    report.push('➕ สร้างแผ่นงาน ' + SHEET.DASHBOARD);
  }
  resetCaches_();

  const missingProps = ['ADMIN_PIN', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CENTER_TARGET_ID'].filter(k => !prop_(k));
  if (missingProps.length) report.push('⚠️ ยังไม่ได้ตั้ง Script Properties: ' + missingProps.join(', '));

  notify_('ตรวจสอบโครงสร้างเรียบร้อย\n\n' + (report.length ? report.join('\n') : 'โครงสร้างครบถ้วนแล้ว ✅'));
}

/** ใส่หนังสือรับประกัน/ความเป็นมาตั้งต้น เฉพาะตอนที่แผ่น "เกี่ยวกับศูนย์" ยังว่าง */
function seedAboutSheet_() {
  if (readTable_(SHEET.ABOUT).length) return false;
  ABOUT_DEFAULTS.forEach(r => insertRow_(SHEET.ABOUT, { section_key: r[0], title: r[1], content: r[2] }));
  const sh = getSheet_(SHEET.ABOUT);
  sh.setColumnWidth(3, 640);
  sh.getRange(CONFIG.DATA_START_ROW, 3, ABOUT_DEFAULTS.length, 1).setWrap(true).setVerticalAlignment('top');
  return true;
}

function lastHeaderCol_(sh) {
  if (sh.getLastColumn() === 0) return 0;
  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0];
  for (let c = headers.length - 1; c >= 0; c--) if (String(headers[c]).trim()) return c + 1;
  return 0;
}

function styleHeaderCells_(sh, col, count) {
  sh.getRange(CONFIG.DESC_ROW, col, 1, count).setFontColor('#5f6f6b').setFontStyle('italic').setWrap(true).setVerticalAlignment('top');
  sh.getRange(CONFIG.HEADER_ROW, col, 1, count).setFontWeight('bold').setBackground('#1f6273').setFontColor('#ffffff');
}

function formatColumn_(sh, field, col) {
  const rows = Math.max(sh.getMaxRows() - CONFIG.DATA_START_ROW + 1, 1);
  const rng = sh.getRange(CONFIG.DATA_START_ROW, col, rows, 1);
  if (TEXT_COLUMNS_.indexOf(field) >= 0) rng.setNumberFormat('@');
  else if (DATE_COLUMNS_.indexOf(field) >= 0) rng.setNumberFormat('dd/mm/yyyy');
  else if (DATETIME_COLUMNS_.indexOf(field) >= 0) rng.setNumberFormat('dd/mm/yyyy hh:mm');
  else if (MONEY_COLUMNS_.indexOf(field) >= 0) rng.setNumberFormat('#,##0');
}

function buildNewSheet_(sh, schema) {
  const fields = schema.fields;
  sh.getRange(CONFIG.TITLE_ROW, 1).setValue(CONFIG.CENTER_NAME + ' — ' + schema.title).setFontSize(14).setFontWeight('bold').setFontColor('#1f6273');
  sh.getRange(CONFIG.DESC_ROW, 1, 1, fields.length).setValues([fields.map(f => f[1])]);
  sh.getRange(CONFIG.HEADER_ROW, 1, 1, fields.length).setValues([fields.map(f => f[0])]);
  styleHeaderCells_(sh, 1, fields.length);
  sh.setFrozenRows(CONFIG.HEADER_ROW);
  fields.forEach((f, i) => {
    sh.setColumnWidth(i + 1, 150);
    formatColumn_(sh, f[0], i + 1);
  });
}

function appendMissingColumns_(sh, schema) {
  const width = sh.getLastColumn();
  const headers = width ? sh.getRange(CONFIG.HEADER_ROW, 1, 1, width).getValues()[0].map(h => String(h).trim()) : [];
  const missing = schema.fields.filter(f => headers.indexOf(f[0]) < 0);
  if (!missing.length) return [];
  const startCol = lastHeaderCol_(sh) + 1;
  if (sh.getMaxColumns() < startCol + missing.length - 1) {
    sh.insertColumnsAfter(sh.getMaxColumns(), startCol + missing.length - 1 - sh.getMaxColumns());
  }
  sh.getRange(CONFIG.DESC_ROW, startCol, 1, missing.length).setValues([missing.map(f => f[1])]);
  sh.getRange(CONFIG.HEADER_ROW, startCol, 1, missing.length).setValues([missing.map(f => f[0])]);
  styleHeaderCells_(sh, startCol, missing.length);
  missing.forEach((f, i) => formatColumn_(sh, f[0], startCol + i));
  return missing.map(f => f[0]);
}

/** ใส่ dropdown เฉพาะคอลัมน์ที่ยังไม่มี validation (ไม่ทับของเดิม) */
function applyValidation_(sh, name) {
  const rules = validationRules_()[name];
  if (!rules) return;
  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const rows = Math.max(sh.getMaxRows() - CONFIG.DATA_START_ROW + 1, 1);
  Object.keys(rules).forEach(field => {
    const col = headers.indexOf(field) + 1;
    if (col < 1) return;
    if (sh.getRange(CONFIG.DATA_START_ROW, col).getDataValidation()) return;
    const v = SpreadsheetApp.newDataValidation().requireValueInList(rules[field], true).setAllowInvalid(true).build();
    sh.getRange(CONFIG.DATA_START_ROW, col, rows, 1).setDataValidation(v);
  });
}

function applyConditionalFormats_(book) {
  const red = '#fdecec';
  const redInk = '#b3261e';
  addTextRule_(book, SHEET.JOBS, 'payment_status', 'equals', STATUS.PAYMENT.PENDING, red, redInk);
  addTextRule_(book, SHEET.JOBS, 'payment_status', 'equals', STATUS.PAYMENT.PAID, '#e7f6ec', '#1b7f3b');
  addTextRule_(book, SHEET.LEAVES, 'rule_check', 'contains', 'เตือน', red, redInk);
  addTextRule_(book, SHEET.WORKERS, 'police_check_status', 'equals', STATUS.POLICE.FAILED, red, redInk);
  addTextRule_(book, SHEET.PAYMENTS, 'payout_status', 'equals', STATUS.PAYOUT.WAITING, '#fff4e0', '#8a5300');
}

function addTextRule_(book, sheetName, field, kind, text, bg, ink) {
  const sh = book.getSheetByName(sheetName);
  if (!sh) return;
  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const col = headers.indexOf(field) + 1;
  if (col < 1) return;
  const range = sh.getRange(CONFIG.DATA_START_ROW, col, Math.max(sh.getMaxRows() - CONFIG.DATA_START_ROW + 1, 1), 1);
  // ลบกฎเดิมที่ใช้ข้อความเดียวกันบนคอลัมน์เดียวกัน กันกฎซ้ำเมื่อรันหลายรอบ
  const rules = sh.getConditionalFormatRules().filter(r => {
    const bc = r.getBooleanCondition();
    if (!bc) return true;
    const sameText = bc.getCriteriaValues().map(String).indexOf(text) >= 0;
    const sameCol = r.getRanges().some(rg => rg.getColumn() === col);
    return !(sameText && sameCol);
  });
  let b = SpreadsheetApp.newConditionalFormatRule();
  b = kind === 'contains' ? b.whenTextContains(text) : b.whenTextEqualTo(text);
  rules.push(b.setBackground(bg).setFontColor(ink).setBold(true).setRanges([range]).build());
  sh.setConditionalFormatRules(rules);
}

function colLetter_(sheetName, field) {
  const sh = ss().getSheetByName(sheetName);
  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  let n = headers.indexOf(field) + 1;
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function buildDashboardSheet_(book) {
  const sh = book.insertSheet(SHEET.DASHBOARD);
  const J = SHEET.JOBS, W = SHEET.WORKERS;
  const r = CONFIG.DATA_START_ROW;
  const jc = f => J + '!' + colLetter_(J, f) + r + ':' + colLetter_(J, f);
  const wc = f => W + '!' + colLetter_(W, f) + r + ':' + colLetter_(W, f);
  const live = jc('job_status') + ',"<>' + STATUS.JOB.CANCELLED + '"';
  const rows = [
    ['ยอดรายรับรวมที่เก็บจากลูกค้า (บาท)', '=SUMIF(' + live + ',' + jc('total_client_amount') + ')'],
    ['รายได้สุทธิของศูนย์ (กำไรสะสม)', '=SUMIF(' + live + ',' + jc('total_center_fee') + ')'],
    ['ยอดค่าจ้างที่จ่ายให้คนทำงานทั้งหมด (บาท)', '=SUMIF(' + live + ',' + jc('total_worker_wage') + ')'],
    ['จำนวนงานทั้งหมด', '=COUNTA(' + jc('job_id') + ')'],
    ['งานที่สำเร็จ', '=COUNTIF(' + jc('job_status') + ',"' + STATUS.JOB.DONE + '")'],
    ['งานที่กำลังทำ', '=COUNTIF(' + jc('job_status') + ',"' + STATUS.JOB.ACTIVE + '")'],
    ['⚠️ ใบงานที่รอลูกค้าชำระเงิน', '=COUNTIFS(' + jc('payment_status') + ',"' + STATUS.PAYMENT.PENDING + '",' + live + ')'],
    ['คนทำงานที่พร้อมลงงานทันที', '=COUNTIF(' + wc('status') + ',"' + STATUS.WORKER.READY + '")'],
  ];
  sh.getRange(1, 1).setValue(CONFIG.CENTER_NAME + ' — สรุปผลการดำเนินงาน').setFontSize(14).setFontWeight('bold').setFontColor('#1f6273');
  sh.getRange(2, 1).setValue(CONFIG.SLOGAN).setFontStyle('italic').setFontColor('#5f6f6b');
  sh.getRange(4, 1, rows.length, 2).setValues(rows);
  sh.getRange(4, 2, rows.length, 1).setNumberFormat('#,##0').setFontWeight('bold');
  sh.getRange(10, 1, 1, 2).setBackground('#fdecec').setFontColor('#b3261e');
  sh.setColumnWidth(1, 320);
  sh.setColumnWidth(2, 160);
}

/* ---------- ทริกเกอร์ / เครื่องมือ ---------- */

function installTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendUpcomingReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendUpcomingReminders').timeBased().everyHours(1).create();
  notify_('✅ เปิดการแจ้งเตือนอัตโนมัติแล้ว\nระบบจะตรวจทุกชั่วโมง และส่ง LINE เตือนคนทำงานก่อนเริ่มงาน 24 ชม.');
}

function testLine() {
  const ok = notifyCenter_('✅ ทดสอบการแจ้งเตือนจาก ' + CONFIG.CENTER_NAME + '\n' + CONFIG.SLOGAN);
  notify_(ok
    ? 'ส่ง LINE สำเร็จ ✅'
    : 'ส่งไม่สำเร็จ ❌\nตรวจสอบ Script Properties: LINE_CHANNEL_ACCESS_TOKEN และ LINE_CENTER_TARGET_ID\n(ดูรายละเอียดใน Executions log)');
}

function showWebAppLinks() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    notify_('ยังไม่ได้ Deploy เว็บแอป\nไปที่ Extensions > Apps Script > Deploy > New deployment > Web app');
    return;
  }
  const link = (label, href) => '<p><b>' + label + '</b><br><a href="' + href + '" target="_blank">' + href + '</a></p>';
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;font-size:13px">' +
    link('หน้าผู้จัดการศูนย์', url) +
    link('ฟอร์มลูกค้าจองบริการ', url + '?page=จองบริการ') +
    link('ฟอร์มผู้รับจ้างยื่นลา', url + '?page=ยื่นใบลา') +
    '</div>').setWidth(520).setHeight(260);
  SpreadsheetApp.getUi().showModalDialog(html, 'ลิงก์ระบบ ' + CONFIG.CENTER_NAME);
}

/** แสดงผลเป็นกล่องข้อความในชีต ถ้ารันจาก Apps Script editor ที่ไม่ได้ผูกกับชีต จะแสดงใน Execution log แทน */
function notify_(msg) {
  console.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // ไม่มีหน้าต่างชีตให้แสดง — ข้อความอยู่ใน Execution log แล้ว
  }
  return msg;
}
