// © 2026 김용현
/**
 * 레이어 목록의 색 표시가 지도와 같은 값에서 나오는지.
 *
 * 예전에는 목록이 늘 사각형이었고 채움·테두리도 지도와 다른 규칙으로 칠해졌다.
 * 포인트 레이어인데 색 테두리 사각형이 보이고, 라인 레이어가 꽉 찬 네모로 보였다.
 * 여기서 못 박는 값은 LayerManager가 addLayer에서 layerInfo에 심는 바로 그 값들이다.
 */
import { describe, it, expect } from 'vitest';
import { swatchSpec, swatchHTML } from './layerSwatch.js';

/** addLayer가 만드는 layerInfo 모양 (스와치가 읽는 필드만) */
function layer(geometryType, overrides = {}) {
  const polygonal = geometryType === 'Polygon' || geometryType === 'MultiPolygon';
  return {
    type: 'vector',
    geometryType,
    color: '#e53935',
    fillColor: '#e53935',
    strokeColor: polygonal ? '#000000' : '#ffffff',
    fillOpacity: 1.0,
    strokeOpacity: 1.0,
    strokeWidth: polygonal ? 2 : 3,
    strokeDash: 'solid',
    pointRadius: 6,
    ...overrides
  };
}

describe('swatchSpec — 도형 종류', () => {
  it('포인트 레이어는 원이다', () => {
    expect(swatchSpec(layer('Point')).shape).toBe('point');
    expect(swatchSpec(layer('MultiPoint')).shape).toBe('point');
  });

  it('라인 레이어는 선이다', () => {
    expect(swatchSpec(layer('LineString')).shape).toBe('line');
    expect(swatchSpec(layer('MultiLineString')).shape).toBe('line');
  });

  it('폴리곤 레이어는 면이다', () => {
    expect(swatchSpec(layer('Polygon')).shape).toBe('polygon');
    expect(swatchSpec(layer('MultiPolygon')).shape).toBe('polygon');
  });
});

describe('swatchSpec — 지도와 같은 값', () => {
  it('포인트는 채움이 색, 테두리가 흰색이다 (지도와 같다)', () => {
    const spec = swatchSpec(layer('Point'));
    expect(spec.fill).toBe('#e53935');
    expect(spec.stroke).toBe('#ffffff');
  });

  it('라인은 굵기와 점선이 반영된다', () => {
    const spec = swatchSpec(layer('LineString', { strokeWidth: 3, strokeDash: 'dashed' }), [6, 4]);
    expect(spec.stroke).toBe('#ffffff');
    expect(spec.strokeWidth).toBe(3);
    expect(spec.dash).toBe('6,4');
  });

  it('폴리곤은 투명도와 검은 테두리가 반영된다', () => {
    const spec = swatchSpec(layer('Polygon', { fillOpacity: 0.5 }));
    expect(spec.fill).toBe('#e53935');
    expect(spec.fillOpacity).toBe(0.5);
    expect(spec.stroke).toBe('#000000');
  });

  it('사용자가 지정한 fillColor·strokeColor가 color를 이긴다', () => {
    const spec = swatchSpec(layer('Polygon', { fillColor: '#1e88e5', strokeColor: '#43a047' }));
    expect(spec.fill).toBe('#1e88e5');
    expect(spec.stroke).toBe('#43a047');
  });

  it('테두리 굵기 0은 0으로 읽는다 (falsy 함정)', () => {
    // strokeWidth 0 은 "테두리 없음"이라는 사용자의 선택이다. 기본값으로 되돌아가면 안 된다
    expect(swatchSpec(layer('Polygon', { strokeWidth: 0 })).strokeWidth).toBe(0);
  });

  it('값이 없는 낡은 layerInfo도 color 하나로 그린다', () => {
    const spec = swatchSpec({ type: 'vector', geometryType: 'Point', color: '#fb8c00' });
    expect(spec.fill).toBe('#fb8c00');
    expect(spec.stroke).toBe('#fb8c00');
  });
});

describe('swatchSpec — 주제도·래스터는 단색 사각형', () => {
  it('단계구분도는 단색 사각형이다', () => {
    expect(swatchSpec(layer('Polygon', { type: 'choropleth' })).shape).toBe('square');
  });

  it('히트맵·래스터도 단색 사각형이다', () => {
    expect(swatchSpec(layer('Point', { type: 'heatmap' })).shape).toBe('square');
    expect(swatchSpec(layer('Polygon', { type: 'raster' })).shape).toBe('square');
  });

  it('카토그램은 type이 vector라 설정으로 알아본다', () => {
    // CartogramTool은 type을 'vector'로 두고 _cartogramConfig만 심는다
    expect(swatchSpec(layer('Polygon', { _cartogramConfig: {} })).shape).toBe('square');
  });
});

describe('swatchHTML', () => {
  it('포인트는 원을 그린다', () => {
    const html = swatchHTML(swatchSpec(layer('Point')));
    expect(html).toContain('<circle');
    expect(html).toContain('#ffffff');
  });

  it('라인은 선을 그리고 면을 칠하지 않는다', () => {
    const html = swatchHTML(swatchSpec(layer('LineString')));
    expect(html).toContain('<line');
    expect(html).not.toContain('<circle');
  });

  it('폴리곤은 면을 그린다', () => {
    const html = swatchHTML(swatchSpec(layer('Polygon')));
    expect(html).toContain('<rect');
    expect(html).not.toContain('<circle');
  });

  it('점선은 stroke-dasharray로 나간다', () => {
    const html = swatchHTML(swatchSpec(layer('LineString', { strokeDash: 'dashed' }), [6, 4]));
    expect(html).toContain('stroke-dasharray="6,4"');
  });

  it('테두리 굵기가 0이면 선을 그리지 않는다', () => {
    const html = swatchHTML(swatchSpec(layer('Polygon', { strokeWidth: 0 })));
    expect(html).not.toContain('stroke-width="0"');
  });

  it('스와치 클릭을 가로채지 않도록 안쪽 요소는 포인터 이벤트를 받지 않는다', () => {
    // e.target이 안쪽 <circle>이 되면 색 편집기가 안 열린다
    expect(swatchHTML(swatchSpec(layer('Point')))).toContain('pointer-events="none"');
  });
});
