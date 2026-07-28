const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// تقديم الملفات الثابتة من مجلد public (مثل اللوقو logo.png)
app.use(express.static(path.join(__dirname, 'public')));

// 1. رابط فحص السيرفر وجلب إعدادات المتجر والشعار
app.get('/', async (req, res) => {
  try {
    let settings = await prisma.storeSetting.findFirst();

    if (!settings) {
      settings = await prisma.storeSetting.create({
        data: {
          storeName: 'Hamza Store',
          currency: 'JOD',
          description: 'نظام إدارة المبيعات والموظفين متكامل',
        },
      });
    }

    res.json({
      success: true,
      message: '🚀 السيرفر وقاعدة البيانات يعملان بنجاح!',
      storeInfo: settings,
      logoUrl: `http://localhost:${PORT}/logo.png`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. رابط لجلب الشعار مباشرة (تأكيد للخدمة)
app.get('/logo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`✅ السيرفر شغال بنجاح على: http://localhost:${PORT}`);
  console.log(`🖼️ رابط اللوقو: http://localhost:${PORT}/logo.png`);
  console.log(`=============================================`);
});