/**
 * เว็บแอป
 *   /exec              หน้าผู้จัดการศูนย์ (ต้องใส่ ADMIN_PIN)
 *   /exec?page=book    ฟอร์มลูกค้าจองบริการ
 *   /exec?page=leave   ฟอร์มผู้รับจ้างยื่นลา
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || '';
  const isPublic = page === 'book' || page === 'leave';
  const tpl = HtmlService.createTemplate(htmlSource_(isPublic ? 'Public' : 'Index'));
  tpl.mode = page;
  tpl.centerName = CONFIG.CENTER_NAME;
  tpl.slogan = CONFIG.SLOGAN;
  tpl.version = CONFIG.VERSION;
  return tpl.evaluate()
    .setTitle(CONFIG.CENTER_NAME + (page === 'book' ? ' · จองบริการ' : page === 'leave' ? ' · ยื่นใบลา' : ' · ผู้จัดการ'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) {
  return htmlSource_(name);
}

/**
 * ไฟล์รวม apps-script/Code.gs ฝัง HTML ไว้ใน HTML_FILES_ (วางไฟล์เดียวก็ใช้ได้)
 * ถ้าไม่มี จะอ่านจากไฟล์ HTML ในโปรเจกต์ตามปกติ
 */
function htmlSource_(name) {
  if (typeof HTML_FILES_ !== 'undefined' && HTML_FILES_[name]) return HTML_FILES_[name];
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
