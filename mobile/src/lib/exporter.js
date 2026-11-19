// "Export CSV" and "Print / PDF" actions of the Reports interface (§5.2.5).
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { FACILITY } from './config';

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(columns, rows) {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','));
  return [head, ...body].join('\n');
}

export async function exportCsv(fileName, columns, rows) {
  const csv = toCsv(columns, rows);
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    return;
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: fileName, UTI: 'public.comma-separated-values-text' });
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function printReport(title, subtitle, columns, rows) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: Helvetica, Arial, sans-serif; padding: 28px; color: #16302A; }
    h1 { font-family: Georgia, serif; color: #0F5A4A; margin: 0; font-size: 22px; }
    h2 { font-family: Georgia, serif; font-size: 16px; margin: 14px 0 4px; }
    .sub { color: #5D6F69; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; background: #0F5A4A; color: #fff; padding: 8px; font-size: 11px; text-transform: uppercase; }
    td { padding: 8px; border-bottom: 1px solid #D6DED9; }
    tr:nth-child(even) td { background: #F4F7F5; }
    .foot { margin-top: 18px; font-size: 10px; color: #9AA8A3; }
  </style></head><body>
    <h1>${esc(FACILITY)}</h1>
    <h2>${esc(title)}</h2>
    <div class="sub">${esc(subtitle)} · Generated ${esc(new Date().toLocaleString())}</div>
    <table>
      <tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>
      ${rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(r[c.key])}</td>`).join('')}</tr>`).join('')}
    </table>
    <div class="foot">Mobile-Based E-Health Application · For Ministry of Health reporting</div>
  </body></html>`;

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}
