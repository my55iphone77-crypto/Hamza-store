require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg'); // ✅ إضافة الـ adapter

const app = express();

// ✅ إنشاء الـ adapter وربطه بالـ PrismaClient
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ رابط فحص السيرفر وجلب إعدادات المتجر
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

// ✅ رابط لجلب الشعار مباشرة
app.get('/logo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});

// ✅ اختبار الاتصال بقاعدة البيانات
async function testConnection() {
  try {
    await prisma.$connect();
    console.log("✅ Connected to DB");
  } catch (err) {
    console.error("❌ Connection error:", err);
  }
}
testConnection();

// ✅ تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`✅ السيرفر شغال بنجاح على: http://localhost:${PORT}`);
  console.log(`🖼️ رابط اللوقو: http://localhost:${PORT}/logo.png`);
  console.log(`=============================================`);
});
