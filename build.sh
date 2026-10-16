#!/usr/bin/env bash
# สร้างไฟล์สำหรับวางใน Apps Script ใหม่ หลังแก้ไฟล์ .gs / .html
#   apps-script/  : Code.gs (รวมทุกไฟล์ .gs) + Index/Public/Styles.html + appsscript.json
#   docs/code/    : สำเนา .txt สำหรับหน้า docs/code.html (ปุ่มคัดลอก)
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p apps-script docs/code
{
  echo "/**"
  echo " * ศูนย์ดวงใจกตัญญู — ไฟล์รวมสำหรับวางใน Apps Script (Code.gs)"
  echo " * สร้างจาก Config.gs, Db.gs, Services.gs, Line.gs, Setup.gs, WebApp.gs"
  echo " */"
  for f in Config Db Services Line Setup WebApp; do
    echo
    echo "/* ======================= $f.gs ======================= */"
    echo
    cat "$f.gs"
  done
} > apps-script/Code.gs
cp Index.html Public.html Styles.html appsscript.json apps-script/

for f in Code.gs Index.html Public.html Styles.html appsscript.json; do
  cp "apps-script/$f" "docs/code/$f.txt"
done
echo "สร้างไฟล์ใน apps-script/ และ docs/code/ แล้ว"
