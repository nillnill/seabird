/**
 * UN/LOCODE 데이터 빌드 스크립트
 * 출처: https://github.com/datasets/un-locode (PDDL 라이선스)
 * 실행: node scripts/build_locode_map.cjs
 * 결과: src/data/locodeMap.js (~17,000개 항만 코드)
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const CSV_URL = 'https://raw.githubusercontent.com/datasets/un-locode/main/data/code-list.csv';
const OUT_PATH = path.join(__dirname, '../src/data/locodeMap.js');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseCSVLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur);
  return cols;
}

async function main() {
  console.log('UN/LOCODE CSV 다운로드 중...');
  const csv = await fetchText(CSV_URL);
  const lines = csv.split('\n');
  console.log(`총 ${lines.length.toLocaleString()} 행`);

  const map = {};
  let portCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    // col[0]=Change, col[1]=Country, col[2]=Location, col[3]=Name, col[7]=Function
    const country  = cols[1]?.trim();
    const location = cols[2]?.trim();
    const name     = cols[3]?.trim();
    const func     = cols[7]?.trim() ?? '';

    if (!country || !location || !name) continue;

    // Function 코드 '1'이 포함 = 해양 항만
    if (!func.includes('1')) continue;

    const code = country + location;
    if (code.length !== 5) continue;

    // 이름 정제: 불필요한 접두사 제거
    const cleanName = name.replace(/\(.*?\)/g, '').trim();
    if (!cleanName) continue;

    map[code] = cleanName;
    portCount++;
  }

  console.log(`해양 항만: ${portCount.toLocaleString()}개`);

  // JS 모듈로 출력
  const entries = Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `  ${JSON.stringify(k)}:${JSON.stringify(v)}`)
    .join(',\n');

  const output = `// UN/LOCODE 해양 항만 데이터 (자동 생성 — scripts/build_locode_map.cjs)
// 출처: https://github.com/datasets/un-locode (PDDL)
// ${portCount.toLocaleString()}개 항만 코드
// eslint-disable-next-line
export const LOCODE_MAP = {
${entries}
};
`;

  fs.writeFileSync(OUT_PATH, output, 'utf8');
  const kb = Math.round(fs.statSync(OUT_PATH).size / 1024);
  console.log(`생성 완료: ${OUT_PATH} (${kb} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
