const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'public', 'bot-updates.json');
const ignored = /(^|\/)(\.env|node_modules|dist|uploads|secrets?|credentials?|.*\.pem|.*\.key)(\/|$)/i;
const labelFor = (file) => {
  if (/^src\/.*(Storefront|HamzaStoreBoot|SocialCards)/i.test(file)) return 'واجهة المتجر وروبوت العملاء';
  if (/^src\/app\//i.test(file)) return 'لوحة الإدارة';
  if (/^(server|store-routes|auth|realtime)/i.test(file)) return 'الخادم والوظائف الداخلية';
  if (/^public\//i.test(file)) return 'أصول وملفات المتجر العامة';
  if (/package|vite|render/i.test(file)) return 'البناء والنشر';
  return 'تحديث برمجي';
};
const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let updates = [];
try {
  const rows = run(['log', '-n', '20', '--pretty=format:%H%x1f%s%x1f%aI']).split('\n').filter(Boolean);
  updates = rows.map((row) => {
    const [hash, subject, date] = row.split('\x1f');
    const files = run(['show', '--format=', '--name-only', hash]).split('\n').map((file) => file.trim()).filter((file) => file && !ignored.test(file)).slice(0, 30);
    const areas = [...new Set(files.map(labelFor))];
    return { id: hash.slice(0, 10), date, title: subject.slice(0, 180), areas };
  });
} catch (_) {
  updates = [];
}
const payload = {
  generatedAt: new Date().toISOString(),
  source: 'deployment-git-history',
  purpose: 'ملخص آمن لتحديثات المتجر البرمجية حتى يفهم روبوت المتجر آخر ما تغيّر دون الاطلاع على الكود أو الأسرار.',
  updates
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`[bot-knowledge] generated ${updates.length} deployment updates`);
