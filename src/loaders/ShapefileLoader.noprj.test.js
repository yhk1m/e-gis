// © 2026 김용현
// @vitest-environment jsdom
/**
 * shpjs에 .prj를 넘기지 않는지 검증.
 *
 * shpjs는 .prj를 받으면 스스로 재투영한다. 그런데 그 변환은 .prj에 적힌 것만 쓴다.
 * 국내 공공데이터 .prj에는 TOWGS84가 빠져 있는 일이 흔하고, 그러면 Bessel 계열
 * 데이텀 이동이 통째로 생략돼 한국에서 약 360m 어긋난다.
 * (제주 LSMD_CONT_UM102_5174 파일로 실측: shpjs 결과가 우리 정의와 368m 차이)
 *
 * 그래서 좌표 변환은 우리가 한다 — 데이텀 파라미터가 들어 있는 CoordinateSystem의
 * 정의로. shpjs에게는 지오메트리만 읽게 하고 .prj는 주지 않는다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// shpjs가 실제로 무엇을 받았는지 붙잡는다
const received = [];
vi.mock('shpjs', () => ({
  default: vi.fn(async (buf) => {
    received.push(buf);
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [160203.925, -11946.65] },
        properties: {}
      }]
    };
  })
}));

const { coordinateSystem } = await import('../core/CoordinateSystem.js');
const { setCrsPrompt } = await import('../core/crsResolver.js');
const { layerManager } = await import('../core/LayerManager.js');
const { shapefileLoader } = await import('./ShapefileLoader.js');
const JSZip = (await import('jszip')).default;

// 제주 파일의 .prj — TOWGS84가 없다 (실제 파일 그대로)
const PRJ_5174_NO_TOWGS84 = 'PROJCS["Korean 1985 / Modified Central Belt",' +
  'GEOGCS["Korean 1985",DATUM["Korean_Datum_1985",SPHEROID["Bessel 1841",6377397.155,299.1528128,' +
  'AUTHORITY["EPSG","7004"]],AUTHORITY["EPSG","6162"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],' +
  'UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4162"]],' +
  'PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",38],' +
  'PARAMETER["central_meridian",127.002890277778],PARAMETER["scale_factor",1],' +
  'PARAMETER["false_easting",200000],PARAMETER["false_northing",500000],' +
  'UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Northing",NORTH],AXIS["Easting",EAST],' +
  'AUTHORITY["EPSG","5174"]]';

beforeAll(() => coordinateSystem.init());
beforeEach(() => {
  received.length = 0;
  setCrsPrompt(null);
});

/** shpjs가 받은 zip 안에 어떤 확장자들이 들어 있는지 */
async function extensionsIn(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).map((n) => n.split('.').pop().toLowerCase()).sort();
}

describe('shpjs에는 .prj를 주지 않는다', () => {
  it('loadFromComponents가 만든 zip에 .prj가 없다', async () => {
    const id = await shapefileLoader.loadFromComponents(
      { shp: new ArrayBuffer(8), dbf: new ArrayBuffer(8), shx: new ArrayBuffer(8), prj: PRJ_5174_NO_TOWGS84 },
      '제주'
    );

    expect(received).toHaveLength(1);
    const exts = await extensionsIn(received[0]);
    expect(exts).not.toContain('prj');
    expect(exts).toContain('shp');

    // .prj는 우리 쪽 판정 근거로는 그대로 쓰인다 — 좌표가 미터이므로
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:5174');
    layerManager.removeLayer(id);
  });

  it('loadFromZip은 .prj를 뺀 zip을 다시 만들어 넘긴다', async () => {
    const zip = new JSZip();
    zip.file('제주.shp', new ArrayBuffer(8));
    zip.file('제주.dbf', new ArrayBuffer(8));
    zip.file('제주.shx', new ArrayBuffer(8));
    zip.file('제주.prj', PRJ_5174_NO_TOWGS84);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    const file = new File([buffer], '제주.zip', { type: 'application/zip' });
    const id = await shapefileLoader.loadFromZip(file);

    expect(received).toHaveLength(1);
    const exts = await extensionsIn(received[0]);
    expect(exts).not.toContain('prj');
    expect(exts).toContain('shp');

    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:5174');
    layerManager.removeLayer(id);
  });
});
