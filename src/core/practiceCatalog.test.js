// © 2026 김용현
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve(__dirname, '../../public/data/builtin');
const catalog = JSON.parse(fs.readFileSync(path.join(base, 'practice_catalog.json'), 'utf8'));
const datasets = catalog.flatMap((g) => (g.datasets || []).map((d) => ({ ...d, group: g.id })));

describe('practice_catalog.json', () => {
  it('등록된 파일이 모두 public/data/builtin 아래에 있다', () => {
    const missing = datasets.filter((d) => !fs.existsSync(path.join(base, d.file))).map((d) => d.file);
    expect(missing).toEqual([]);
  });

  it('2호선 역(점, spatial)과 8~9시 승하차(속성)가 등록돼 있다', () => {
    const stations = datasets.find((d) => d.id === 'seoul-subway-line2');
    const rush = datasets.find((d) => d.id === 'seoul-subway-line2-rush');
    expect(stations).toMatchObject({ group: 'point-data', type: 'spatial' });
    expect(stations.file).toMatch(/\.geojson$/);
    expect(rush).toMatchObject({ group: 'attribute-data', type: 'attribute' });
    expect(rush.file).toMatch(/\.csv$/);
  });

  it('2호선 역 GeoJSON은 EPSG:4326 Point 51개이고 sub_nm을 가진다', () => {
    const d = datasets.find((x) => x.id === 'seoul-subway-line2');
    const gj = JSON.parse(fs.readFileSync(path.join(base, d.file), 'utf8'));
    expect(gj.features).toHaveLength(51);
    for (const f of gj.features) {
      expect(f.geometry.type).toBe('Point');
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThan(126.7); expect(lon).toBeLessThan(127.3);
      expect(lat).toBeGreaterThan(37.4); expect(lat).toBeLessThan(37.7);
      expect(typeof f.properties.sub_nm).toBe('string');
    }
  });

  it('승하차 CSV는 UTF-8 BOM이고 49행 · 열 stn_nm,boarding,getting off', () => {
    const d = datasets.find((x) => x.id === 'seoul-subway-line2-rush');
    const buf = fs.readFileSync(path.join(base, d.file));
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = buf.toString('utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
    expect(lines[0]).toBe('stn_nm,boarding,getting off');
    expect(lines).toHaveLength(50);
    expect(lines[1]).toBe('강남,2766,13890');
  });
});
