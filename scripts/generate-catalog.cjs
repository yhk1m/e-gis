// © 2026 김용현
/**
 * 내장 데이터 카탈로그 자동 생성
 *
 * 사용법: npm run catalog
 *
 * public/data/builtin/        ← GeoJSON 파일 → spatial_catalog.json
 * public/data/builtin/xlsx/   ← XLSX 파일   → attribute_catalog.json
 *
 * 파일만 넣고 이 스크립트를 실행하면 카탈로그가 자동 생성됩니다.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const BUILTIN_DIR = path.join(__dirname, '..', 'public', 'data', 'builtin');
const XLSX_DIR = path.join(BUILTIN_DIR, 'xlsx');
const SPATIAL_CATALOG_PATH = path.join(BUILTIN_DIR, 'spatial_catalog.json');
const ATTR_CATALOG_PATH = path.join(BUILTIN_DIR, 'attribute_catalog.json');

// ========================================
//  공간정보 카탈로그 (GeoJSON)
// ========================================
function generateSpatialCatalog() {
  console.log('=== 공간정보 스캔 ===');

  const files = fs.readdirSync(BUILTIN_DIR).filter(f =>
    f.endsWith('.geojson') || f.endsWith('.json')
  );

  if (files.length === 0) {
    console.log('  GeoJSON 파일 없음');
    fs.writeFileSync(SPATIAL_CATALOG_PATH, '[]', 'utf8');
    return;
  }

  const catalog = [];

  for (const file of files) {
    // 카탈로그 파일 자체는 건너뛰기
    if (file.endsWith('_catalog.json')) continue;

    const filePath = path.join(BUILTIN_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const geojson = JSON.parse(raw);

      if (geojson.type !== 'FeatureCollection' || !geojson.features) {
        console.warn(`  [건너뜀] ${file}: FeatureCollection이 아님`);
        continue;
      }

      const features = geojson.features;
      const featureCount = features.length;
      if (featureCount === 0) {
        console.warn(`  [건너뜀] ${file}: 피처 없음`);
        continue;
      }

      // 지오메트리 타입 추출
      const geomTypes = new Set();
      features.forEach(f => {
        if (f.geometry && f.geometry.type) geomTypes.add(f.geometry.type);
      });
      const geometryType = [...geomTypes].join('/');

      // 속성 필드 추출 (첫 피처 기준)
      const properties = features[0].properties
        ? Object.keys(features[0].properties)
        : [];

      // 파일명 → ID, 이름 생성
      const baseName = file.replace(/\.(geojson|json)$/i, '');
      const id = baseName.replace(/[^a-zA-Z0-9가-힣_-]/g, '-').toLowerCase();

      // 출처 추정
      let source = '';
      if (properties.includes('base_year')) source = 'KOSTAT (통계청)';
      else if (properties.includes('ISO_A3') || properties.includes('CONTINENT')) source = 'Natural Earth';

      catalog.push({
        id,
        name: baseName.replace(/[_-]/g, ' '),
        description: `${featureCount}개 피처 (${geometryType})`,
        file,
        featureCount,
        geometryType,
        properties,
        source,
        tags: properties.slice(0, 5)
      });

      console.log(`  [추가] ${file} → ${featureCount}개 피처, ${geometryType}`);
    } catch (e) {
      console.warn(`  [오류] ${file}: ${e.message}`);
    }
  }

  fs.writeFileSync(SPATIAL_CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`  ✓ spatial_catalog.json (${catalog.length}개)\n`);
}

// ========================================
//  속성정보 카탈로그 (XLSX)
// ========================================
function generateAttributeCatalog() {
  console.log('=== 속성정보 스캔 ===');

  if (!fs.existsSync(XLSX_DIR)) {
    fs.mkdirSync(XLSX_DIR, { recursive: true });
    console.log('  xlsx 폴더 생성');
  }

  const files = fs.readdirSync(XLSX_DIR).filter(f =>
    f.endsWith('.xlsx') || f.endsWith('.xls')
  );

  if (files.length === 0) {
    console.log('  XLSX 파일 없음');
    fs.writeFileSync(ATTR_CATALOG_PATH, '[]', 'utf8');
    return;
  }

  const catalog = [];

  for (const file of files) {
    const filePath = path.join(XLSX_DIR, file);
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (jsonData.length < 2) {
        console.warn(`  [건너뜀] ${file}: 데이터 없음`);
        continue;
      }

      const headers = jsonData[0].map(h => String(h || '').trim()).filter(h => h);
      const rowCount = jsonData.length - 1;

      const baseName = file.replace(/\.(xlsx|xls)$/i, '');
      const id = baseName.replace(/[^a-zA-Z0-9가-힣_-]/g, '-').toLowerCase();

      // 키 컬럼 추정
      const keyGuess = headers.find(h =>
        /^(code|id|코드|지역코드|시도코드|행정코드)$/i.test(h)
      ) || headers[0];

      catalog.push({
        id,
        name: sheetName !== 'Sheet1' ? sheetName : baseName.replace(/[_-]/g, ' '),
        description: `${rowCount}행 × ${headers.length}열`,
        file: `xlsx/${file}`,
        columns: headers,
        keyColumn: keyGuess,
        rowCount,
        source: ''
      });

      console.log(`  [추가] ${file} → ${rowCount}행, ${headers.length}열`);
    } catch (e) {
      console.warn(`  [오류] ${file}: ${e.message}`);
    }
  }

  fs.writeFileSync(ATTR_CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`  ✓ attribute_catalog.json (${catalog.length}개)\n`);
}

// ========================================
//  실행
// ========================================
generateSpatialCatalog();
generateAttributeCatalog();
console.log('카탈로그 생성 완료!');
