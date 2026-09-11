// © 2026 김용현
/**
 * 내장 래스터 카탈로그 자동 생성
 *
 * 사용법: npm run catalog
 *
 * public/data/builtin/raster/  ← GeoTIFF 파일 → raster_catalog.json
 *
 * 파일만 넣고 이 스크립트를 실행하면 카탈로그가 자동 생성됩니다.
 * 점·선·면·속성 실습 데이터는 practice_catalog.json 에 직접 등록합니다
 * (docs/practice-data-guide.md).
 */

const fs = require('fs');
const path = require('path');

const BUILTIN_DIR = path.join(__dirname, '..', 'public', 'data', 'builtin');
const RASTER_DIR = path.join(BUILTIN_DIR, 'raster');
const RASTER_CATALOG_PATH = path.join(BUILTIN_DIR, 'raster_catalog.json');

// ========================================
//  래스터 카탈로그 (GeoTIFF)
// ========================================
function generateRasterCatalog() {
  console.log('=== 래스터 스캔 ===');

  if (!fs.existsSync(RASTER_DIR)) {
    fs.mkdirSync(RASTER_DIR, { recursive: true });
    console.log('  raster 폴더 생성');
  }

  const files = fs.readdirSync(RASTER_DIR).filter(f =>
    /\.(tif|tiff|geotiff)$/i.test(f)
  );

  if (files.length === 0) {
    console.log('  GeoTIFF 파일 없음');
    fs.writeFileSync(RASTER_CATALOG_PATH, '[]', 'utf8');
    return;
  }

  const fmtSize = (bytes) => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  };

  const catalog = [];

  for (const file of files) {
    const filePath = path.join(RASTER_DIR, file);
    try {
      const stats = fs.statSync(filePath);
      const baseName = file.replace(/\.(tif|tiff|geotiff)$/i, '');
      const id = baseName.replace(/[^a-zA-Z0-9가-힣_-]/g, '-').toLowerCase();

      catalog.push({
        id,
        name: baseName.replace(/[_-]/g, ' '),
        description: `GeoTIFF (${fmtSize(stats.size)})`,
        file: `raster/${file}`,
        fileSize: stats.size,
        source: '',
        tags: [baseName]
      });

      console.log(`  [추가] ${file} → ${fmtSize(stats.size)}`);
    } catch (e) {
      console.warn(`  [오류] ${file}: ${e.message}`);
    }
  }

  fs.writeFileSync(RASTER_CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`  ✓ raster_catalog.json (${catalog.length}개)\n`);
}

// ========================================
//  실행
// ========================================
generateRasterCatalog();
console.log('카탈로그 생성 완료!');
