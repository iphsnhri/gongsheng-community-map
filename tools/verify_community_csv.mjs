import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Workbook } from '@oai/artifact-tool';

const paths = [
  '社區資料定稿.csv',
  'website/dist/communities.csv',
  'website/dist/data/communities.csv',
];
const contents = await Promise.all(paths.map(path => fs.readFile(path, 'utf8')));
assert.equal(new Set(contents).size, 1, 'CSV copies differ');

const workbook = await Workbook.fromCSV(contents[0].replace(/^\uFEFF/, ''), { sheetName: '社區資料' });
const values = workbook.worksheets.getItem('社區資料').getRange('A1:N31').values;
assert.equal(values.length, 31);
assert.equal(values[0].length, 14);

const headers = values[0];
const records = values.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
assert.equal(new Set(records.map(record => record.社區ID)).size, 30);
assert.deepEqual(records.map(record => Number(record.顯示順序)), Array.from({ length: 30 }, (_, index) => index + 1));
assert.equal(records.filter(record => String(record.社區照片網址).trim()).length, 17);
for (const record of records) {
  assert.ok(String(record.社區簡介).trim(), `${record.社區ID} has no introduction`);
  assert.ok(String(record.計畫成果重點).trim(), `${record.社區ID} has no highlights`);
}

console.log(JSON.stringify({ rows: 30, columns: 14, uniqueIds: 30, photos: 17, copiesMatch: true }));
