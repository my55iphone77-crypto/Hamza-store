@echo off
chcp 65001 > nul
cd /d "%~dp0"

set REPO_URL=https://github.com/my55iphone77-crypto/Hamza-store.git

echo تهيئة مستودع جديد نظيف...
if exist .git rmdir /s /q .git
git init

echo إنشاء ملف .gitignore...
(
echo .env
echo node_modules/
echo dist/
) > .gitignore

echo تجهيز الملفات...
git add .

echo حفظ التعديلات...
git commit -m "Clean commit: %date% %time%"

echo ربط المستودع...
git branch -M main
git remote add origin %REPO_URL%

echo جاري الرفع الإجباري...
git push -u origin main --force
if errorlevel 1 (
    echo.
    echo فشل الرفع. تأكد من تسجيل الدخول وصلاحياتك.
    pause
    exit /b 1
)

echo ========================================
echo تم الرفع بنجاح
echo ========================================
timeout /t 5 > nul