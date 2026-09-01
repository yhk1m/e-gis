// © 2026 김용현
/**
 * 좌표계 정의 검증.
 *
 * 정의가 두 곳(CoordinateSystem·ShapefileLoader)에 흩어져 서로 어긋나 있었다.
 * 투영 원점을 역변환하면 (lon_0, lat_0)가 나온다는 성질로 각 정의를 못박는다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import proj4 from 'proj4';
import { coordinateSystem } from './CoordinateSystem.js';

function originOf(code, x0, y0) {
  return proj4(code, 'EPSG:4326', [x0, y0]);
}

describe('좌표계 정의', () => {
  beforeAll(() => coordinateSystem.init());

  it('목록에 있는 좌표계는 모두 proj4에 등록된다', () => {
    const codes = coordinateSystem.getAvailableCRS().map((c) => c.code);
    expect(codes.length).toBeGreaterThan(10);
    for (const code of codes) {
      expect(proj4.defs(code), code).toBeTruthy();
    }
  });

  it('Korea 2000 원점 4종의 중앙경선이 EPSG 정의와 같다', () => {
    // 서부 125 · 중부 127 · 동부 129 · 동해 131
    expect(originOf('EPSG:5185', 200000, 600000)[0]).toBeCloseTo(125, 6);
    expect(originOf('EPSG:5186', 200000, 600000)[0]).toBeCloseTo(127, 6);
    expect(originOf('EPSG:5187', 200000, 600000)[0]).toBeCloseTo(129, 6);
    // 예전: 5188이 125(서부원점 값)로 정의돼 있었다
    expect(originOf('EPSG:5188', 200000, 600000)[0]).toBeCloseTo(131, 6);
  });

  it('UTM-K(5179)는 중앙경선 127.5, 원점 (1000000, 2000000)이다', () => {
    const [lon, lat] = originOf('EPSG:5179', 1000000, 2000000);
    expect(lon).toBeCloseTo(127.5, 6);
    expect(lat).toBeCloseTo(38, 6);
  });

  it('Korean 1985 중부(5174)는 2097보다 중앙경선이 0.0029도 동쪽이다', () => {
    const a = originOf('EPSG:5174', 200000, 500000)[0];
    const b = originOf('EPSG:2097', 200000, 500000)[0];
    expect(a - b).toBeCloseTo(0.0028902777778, 6);
  });

  it('UTM 52N은 중앙경선 129, UTM 51N은 123이다', () => {
    expect(originOf('EPSG:32652', 500000, 0)[0]).toBeCloseTo(129, 6);
    expect(originOf('EPSG:32651', 500000, 0)[0]).toBeCloseTo(123, 6);
  });

  // 아래 왕복 테스트("서울시청을 각 좌표계로...")는 정변환→역변환이 같은 정의를
  // 쓰므로 파라미터가 틀려도 항상 항등이 되어 통과한다 — lon_0이 뒤바뀌거나
  // y_0을 잘못 적어도 잡아내지 못한다. 그래서 왕복 테스트에 안 걸리는
  // 다섯 좌표계(5181·5173·5176·5177·5178)는 원점 역변환으로 따로 못박는다.
  //
  // 5173·5176·5177·5178은 Bessel + towgs84(3파라미터) 데이텀이다. 이걸 곧장
  // EPSG:4326(WGS84, 편이 없음)으로 역변환하면 towgs84 편이가 한쪽으로만
  // 걸려서 위치마다 다른 크기로 lon_0에서 최대 0.003도 어긋난다 — 그래서
  // EPSG:4326 대신 "같은 타원체 + 같은 towgs84"를 쓰는 경위도로 역변환한다.
  // 그러면 편이가 걸렸다가 그대로 되돌아와 순수 투영 역산만 남는다.
  // (5181은 GRS80이라 편이가 없어 EPSG:4326 그대로 써도 된다.)
  it('Korean 1985/Korea 2000 나머지 원점도 중앙경선이 EPSG 정의와 같다', () => {
    const BESSEL_SAME_DATUM = '+proj=longlat +ellps=bessel +no_defs +towgs84=-115.8,474.99,674.11';
    const besselOriginOf = (code, x0, y0) => proj4(code, BESSEL_SAME_DATUM, [x0, y0]);

    expect(originOf('EPSG:5181', 200000, 500000)[0]).toBeCloseTo(127, 6);
    expect(besselOriginOf('EPSG:5173', 200000, 500000)[0]).toBeCloseTo(125.0028902777778, 6);
    expect(besselOriginOf('EPSG:5176', 200000, 500000)[0]).toBeCloseTo(129.0028902777778, 6);
    expect(besselOriginOf('EPSG:5177', 200000, 500000)[0]).toBeCloseTo(131.0028902777778, 6);
    expect(besselOriginOf('EPSG:5178', 1000000, 2000000)[0]).toBeCloseTo(127.5, 6);
  });

  it('서울시청을 각 좌표계로 보냈다 되돌리면 제자리다', () => {
    const seoul = [126.9784, 37.5667];
    for (const { code } of coordinateSystem.getAvailableCRS()) {
      const there = proj4('EPSG:4326', code, seoul);
      const back = proj4(code, 'EPSG:4326', there);
      expect(back[0], code).toBeCloseTo(seoul[0], 5);
      expect(back[1], code).toBeCloseTo(seoul[1], 5);
    }
  });

  it('isSupported는 정의에 있는 코드만 받아들인다', () => {
    expect(coordinateSystem.isSupported('EPSG:5186')).toBe(true);
    expect(coordinateSystem.isSupported('EPSG:9999')).toBe(false);
    expect(coordinateSystem.isSupported(null)).toBe(false);
  });
});
