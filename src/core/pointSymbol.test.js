// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  POINT_ICONS, normalizePointSymbol, isCustomPointSymbol, pointSymbolSize, imageBox,
  glyphColorFor, iconMarkerSvg, iconMarkerDataUrl, iconButtonSvg
} from './pointSymbol.js';
import { swatchSpec, swatchHTML } from '../ui/panels/layerSwatch.js';
import { buildLegendModel } from '../tools/legendModel.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('normalizePointSymbol', () => {
  it('없거나 모르는 값은 원', () => {
    expect(normalizePointSymbol(undefined)).toEqual({ kind: 'circle' });
    expect(normalizePointSymbol({ kind: 'icon', icon: 'nope' })).toEqual({ kind: 'circle' });
    expect(normalizePointSymbol({ kind: 'image', dataUrl: 'http://x/a.png' })).toEqual({ kind: 'circle' });
  });
  it('아이콘과 그림을 정돈한다', () => {
    expect(normalizePointSymbol({ kind: 'icon', icon: 'school', extra: 1 })).toEqual({ kind: 'icon', icon: 'school' });
    expect(normalizePointSymbol({ kind: 'image', dataUrl: PNG, width: 64, height: 32 }))
      .toEqual({ kind: 'image', dataUrl: PNG, width: 64, height: 32 });
    expect(isCustomPointSymbol({ kind: 'icon', icon: 'star' })).toBe(true);
    expect(isCustomPointSymbol(null)).toBe(false);
  });
});

describe('크기', () => {
  it('기본 반지름 6이면 24px', () => {
    expect(pointSymbolSize(undefined)).toBe(24);
    expect(pointSymbolSize(10)).toBe(32);
  });
  it('그림은 긴 변에 맞추고 비율을 지킨다', () => {
    expect(imageBox({ width: 100, height: 50 }, 24)).toEqual({ width: 24, height: 12 });
    expect(imageBox({ width: 30, height: 60 }, 24)).toEqual({ width: 12, height: 24 });
  });
});

describe('아이콘 그림', () => {
  it('아이콘 12개, id가 겹치지 않는다', () => {
    expect(POINT_ICONS).toHaveLength(12);
    expect(new Set(POINT_ICONS.map((i) => i.id)).size).toBe(12);
  });
  it('밝은 면에는 어두운 선, 어두운 면에는 흰 선', () => {
    expect(glyphColorFor('#ffffff')).toBe('#1a1e25');
    expect(glyphColorFor('#fde047')).toBe('#1a1e25');
    expect(glyphColorFor('#1d4ed8')).toBe('#ffffff');
    expect(glyphColorFor('rgba(239, 68, 68, 1)')).toBe('#ffffff');
  });
  it('마커 SVG에 크기와 면 색이 들어간다', () => {
    const svg = iconMarkerSvg('school', { fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }, 32);
    expect(svg).toContain('width="32"');
    expect(svg).toContain('fill="#ef4444"');
    expect(iconMarkerDataUrl('school', { fill: '#ef4444', stroke: '#fff' })).toMatch(/^data:image\/svg\+xml/);
    expect(iconButtonSvg('school')).toContain('currentColor');
  });
});

describe('레이어 목록 스와치', () => {
  const base = { type: 'vector', geometryType: 'Point', color: '#ef4444', fillColor: '#ef4444', strokeColor: '#ffffff', strokeWidth: 2 };
  it('원이면 그대로 circle', () => {
    expect(swatchHTML(swatchSpec(base))).toContain('<circle cx="8"');
  });
  it('아이콘이면 마커 그림', () => {
    const html = swatchHTML(swatchSpec({ ...base, pointSymbol: { kind: 'icon', icon: 'tree' } }));
    expect(html).toContain('<path d="M12 22v-6');
  });
  it('그림이면 image 요소', () => {
    const html = swatchHTML(swatchSpec({ ...base, pointSymbol: { kind: 'image', dataUrl: PNG, width: 10, height: 10 } }));
    expect(html).toContain(`<image href="${PNG}"`);
  });
});

describe('범례', () => {
  it('아이콘 포인트 범례 기호에 그림 주소가 붙는다', () => {
    const layer = { id: 'a', name: '학교', type: 'vector', geometryType: 'Point', color: '#ef4444', fillColor: '#ef4444', pointSymbol: { kind: 'icon', icon: 'school' } };
    const model = buildLegendModel(layer);
    const sym = model.items[0].symbol;
    expect(sym.pointImage.src).toMatch(/^data:image\/svg\+xml/);
  });
  it('원 포인트는 그림이 없다', () => {
    const layer = { id: 'b', name: '점', type: 'vector', geometryType: 'Point', color: '#ef4444' };
    expect(buildLegendModel(layer).items[0].symbol.pointImage).toBeNull();
  });
});
