/**
 * เว็บแอป
 *   /exec              หน้าผู้จัดการศูนย์ (ต้องใส่ ADMIN_PIN)
 *   /exec?page=book    ฟอร์มลูกค้าจองบริการ
 *   /exec?page=leave   ฟอร์มผู้รับจ้างยื่นลา
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || '';
  const isPublic = page === 'book' || page === 'leave';
  const tpl = HtmlService.createTemplateFromFile(isPublic ? 'Public' : 'Index');
  tpl.mode = page;
  tpl.centerName = CONFIG.CENTER_NAME;
  tpl.slogan = CONFIG.SLOGAN;
  return tpl.evaluate()
    .setTitle(CONFIG.CENTER_NAME + (page === 'book' ? ' · จองบริการ' : page === 'leave' ? ' · ยื่นใบลา' : ' · ผู้จัดการ'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
