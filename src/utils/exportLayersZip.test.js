// © 2026 김용현
import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import JSZip from 'jszip';
import { buildGeoJsonFiles, zipFileName, buildLayersZip } from './exportLayersZip.js';

function pointLayer(id, name, lonLat = [127, 37.5]) {
  return {
    id, name, type: 'vector',
    source: new VectorSource({ features: [new Feature({ geometry: new Point(fromLonLat(lonLat)), pop: 3 })] })
  };
}

describe('buildGeoJsonFiles', () => {
  it('벡터 레이어마다 <이름>.geojson 을 EPSG:4326 좌표로 만든다', () => {
    const { files, skipped } = buildGeoJsonFiles([pointLayer('a', '학교', [127, 37.5])]);
    expect(Object.keys(files)).toEqual(['학교.geojson']);
    const gj = JSON.parse(files['학교.geojson']);
    expect(gj.type).toBe('FeatureCollection');
    const [x, y] = gj.features[0].geometry.coordinates;
    expect(x).toBeCloseTo(127, 6);
    expect(y).toBeCloseTo(37.5, 6);
    expect(gj.features[0].properties.pop).toBe(3);
    expect(skipped).toEqual([]);
  });

  it('파일 이름에 못 쓰는 글자는 _ 로 바꾸고 겹치면 _2, _3 을 붙인다', () => {
    const { files } = buildGeoJsonFiles([
      pointLayer('a', '서울/학교'),
      pointLayer('b', '서울/학교'),
      pointLayer('c', '서울_학교'),
      pointLayer('d', '')
    ]);
    expect(Object.keys(files)).toEqual([
      '서울_학교.geojson', '서울_학교_2.geojson', '서울_학교_3.geojson', '레이어.geojson'
    ]);
  });

  it('벡터가 아닌 레이어는 건너뛰고 이름을 돌려준다', () => {
    const { files, skipped } = buildGeoJsonFiles([
      pointLayer('a', '학교'),
      { id: 'r', name: '위성 사진', type: 'raster', source: null },
      { id: 'h', name: '열지도', type: 'heatmap', source: new VectorSource() },
      null
    ]);
    expect(Object.keys(files)).toEqual(['학교.geojson']);
    expect(skipped).toEqual(['위성 사진', '열지도']);
  });
});

describe('zipFileName', () => {
  it('레이어_N개.zip', () => {
    expect(zipFileName(3)).toBe('레이어_3개.zip');
  });
});

describe('buildLayersZip', () => {
  it('파일 맵을 그대로 zip 에 담는다', async () => {
    const data = await buildLayersZip({ '학교.geojson': '{"a":1}', '병원.geojson': '{}' }, 'uint8array');
    const zip = await JSZip.loadAsync(data);
    expect(Object.keys(zip.files).sort()).toEqual(['병원.geojson', '학교.geojson']);
    expect(await zip.file('학교.geojson').async('string')).toBe('{"a":1}');
  });
});
