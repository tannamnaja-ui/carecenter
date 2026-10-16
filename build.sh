#!/usr/bin/env bash
# สร้างไฟล์สำหรับวางใน Apps Script ใหม่ หลังแก้ไฟล์ .gs / .html
#   apps-script/Code.gs : รวมทุกไฟล์ .gs + ฝัง Index/Public/Styles.html ไว้ข้างใน (วางไฟล์เดียวจบ)
#   apps-script/*.html  : สำเนาไฟล์ HTML (ไม่จำเป็นต้องวาง ถ้าใช้ Code.gs ไฟล์รวม)
#   docs/code/          : สำเนา .txt สำหรับหน้า docs/code.html (ปุ่มคัดลอก)
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p apps-script docs/code
{
  echo "/**"
  echo " * ศูนย์ดวงใจกตัญญู — ไฟล์รวมสำหรับวางใน Apps Script (Code.gs)"
  echo " * รวม Config.gs, Db.gs, Services.gs, Line.gs, Setup.gs, WebApp.gs และหน้าเว็บ HTML ทั้งหมด"
  echo " * วางไฟล์นี้ไฟล์เดียวในโปรเจกต์ (ลบไฟล์ .gs อื่นทิ้ง) — ไม่ต้องสร้างไฟล์ HTML แยก"
  echo " */"
  for f in Config Db Services Line Setup WebApp; do
    echo
    echo "/* ======================= $f.gs ======================= */"
    echo
    cat "$f.gs"
  done
  echo
  echo "/* ======================= หน้าเว็บ (HTML) ======================= */"
  echo
  node -e '
    const fs = require("fs");
    const files = {};
    for (const n of ["Index", "Public", "Styles"]) files[n] = fs.readFileSync(n + ".html", "utf8");
    process.stdout.write("const HTML_FILES_ = " + JSON.stringify(files, null, 2) + ";\n");
  '
} > apps-script/Code.gs
cp Index.html Public.html Styles.html appsscript.json apps-script/

for f in Code.gs Index.html Public.html Styles.html appsscript.json; do
  cp "apps-script/$f" "docs/code/$f.txt"
done
echo "สร้างไฟล์ใน apps-script/ และ docs/code/ แล้ว"
