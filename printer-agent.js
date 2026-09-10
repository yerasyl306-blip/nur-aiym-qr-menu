// Run this on the Windows cash computer after the XPrinter 58 driver is installed.
// Example: set MENU_URL=https://nur-aiym-qr-menu.onrender.com && set PRINTER_KEY=... && set XPRINTER_NAME=XPrinter XP-58 && node printer-agent.js
const { execFile } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const base = (process.env.MENU_URL || '').replace(/\/$/, '');
const key = process.env.PRINTER_KEY;
const printer = process.env.XPRINTER_NAME || 'XPrinter XP-58';
if (!base || !key) throw Error('MENU_URL және PRINTER_KEY орнатыңыз.');
const money = n => Number(n || 0).toLocaleString('kk-KZ') + ' ₸';
function receipt(o) {
  const where = o.type === 'table' ? `ҮСТЕЛ №${o.table}` : o.type === 'delivery' ? 'ЖЕТКІЗУ' : 'САМОВЫВОЗ';
  return ['НҰР-АЙЫМ', where, '--------------------------------', ...o.items.map(x => `${x.name} x${x.qty}  ${money(x.price * x.qty)}`), '--------------------------------', `ЖАЛПЫ: ${money(o.total)}`, o.customer && `Клиент: ${o.customer}`, o.phone && `Тел: ${o.phone}`, o.address && `Мекенжай: ${o.address}`, '', o.date, `Тапсырыс #${o.number}`, '\f'].filter(Boolean).join('\r\n');
}
function print(job) {
  return new Promise((resolve, reject) => {
    const file = path.join(os.tmpdir(), `nur-aiym-${job.id}.txt`); fs.writeFileSync(file, receipt(job.order), 'utf8');
    execFile('powershell.exe', ['-NoProfile', '-Command', `Get-Content -Raw -LiteralPath '${file.replace(/'/g, "''")}' | Out-Printer -Name '${printer.replace(/'/g, "''")}'`], error => { try { fs.unlinkSync(file); } catch {} error ? reject(error) : resolve(); });
  });
}
async function poll() {
  try { const r = await fetch(base + '/api/print-jobs', { headers: { 'X-Printer-Key': key } }); const body = await r.json(); if (!r.ok) throw Error('Сервер принтер кілтін қабылдамады.'); for (const job of body.jobs) { await print(job); const ack = await fetch(base + '/api/print-jobs/' + encodeURIComponent(job.id) + '/ack', { method: 'POST', headers: { 'X-Printer-Key': key } }); if (!ack.ok) throw Error('Чек басылды, бірақ сервер растауды қабылдамады. Ол 1 минуттан кейін қайта жіберіледі.'); console.log('Басылды:', job.order.number); } } catch (e) { console.error('Басып шығару кезегі:', e.message); }
}
poll(); setInterval(poll, 2000);
