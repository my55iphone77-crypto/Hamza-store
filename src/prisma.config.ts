// هذا الملف تم توليده بواسطة Prisma
// تأكد أنك مثبت الحزم التالية:
// npm install --save-dev prisma dotenv

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",       // مكان ملف الـ schema
  migrations: {
    path: "prisma/migrations",          // مكان ملفات المهاجرات
  },
  datasource: {
    url: process.env.DATABASE_URL,      // رابط قاعدة البيانات من .env
  },
});
