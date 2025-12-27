/**
 * GeocodingService - Nominatim(OSM) 기반 지오코딩 서비스
 * 전 세계 위치 검색 지원
 */

class GeocodingService {
  constructor() {
    this.baseUrl = 'https://nominatim.openstreetmap.org';
    this.cache = new Map();
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1초 간격 (Nominatim 정책)
  }

  /**
   * 주소/장소명 검색
   * @param {string} query - 검색어
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Array>} 검색 결과
   */
  async search(query, options = {}) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const trimmedQuery = query.trim();

    // 캐시 확인
    const cacheKey = trimmedQuery.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // API 요청 간격 제한
    await this.throttle();

    try {
      const params = new URLSearchParams({
        q: trimmedQuery,
        format: 'json',
        addressdetails: '1',
        limit: options.limit || '8',
        'accept-language': 'ko,en'
      });

      // 뷰포트 제한 (선택)
      if (options.viewbox) {
        params.append('viewbox', options.viewbox);
        params.append('bounded', '1');
      }

      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: {
          'User-Agent': 'eGIS/1.0 (educational GIS application)'
        }
      });

      if (!response.ok) {
        throw new Error(`검색 실패: ${response.status}`);
      }

      const data = await response.json();

      // 결과 정리
      const results = data.map(item => ({
        displayName: item.display_name,
        shortName: this.getShortName(item),
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        boundingBox: item.boundingbox ? item.boundingbox.map(parseFloat) : null,
        type: item.type,
        category: item.class,
        address: item.address
      }));

      // 캐시 저장 (최대 100개)
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, results);

      return results;
    } catch (error) {
      console.error('지오코딩 오류:', error);
      return [];
    }
  }

  /**
   * 짧은 이름 생성
   */
  getShortName(item) {
    const addr = item.address || {};

    // 우선순위에 따라 이름 구성
    const parts = [];

    // 장소명
    const name = addr.amenity || addr.building || addr.leisure ||
                 addr.tourism || addr.shop || addr.office ||
                 addr.historic || addr.natural || addr.place ||
                 item.name;

    if (name) {
      parts.push(name);
    }

    // 도시/구
    const city = addr.city || addr.town || addr.village ||
                 addr.county || addr.municipality;
    if (city && city !== name) {
      parts.push(city);
    }

    // 국가 (한국이 아닌 경우)
    const country = addr.country;
    if (country && country !== '대한민국' && country !== 'South Korea') {
      parts.push(country);
    }

    return parts.join(', ') || item.display_name.split(',')[0];
  }

  /**
   * API 요청 간격 제한
   */
  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minRequestInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minRequestInterval - elapsed)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 역지오코딩 (좌표 → 주소)
   */
  async reverseGeocode(lat, lon) {
    await this.throttle();

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        format: 'json',
        addressdetails: '1',
        'accept-language': 'ko,en'
      });

      const response = await fetch(`${this.baseUrl}/reverse?${params}`, {
        headers: {
          'User-Agent': 'eGIS/1.0 (educational GIS application)'
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      return {
        displayName: data.display_name,
        shortName: this.getShortName(data),
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon),
        address: data.address
      };
    } catch (error) {
      console.error('역지오코딩 오류:', error);
      return null;
    }
  }
}

export const geocodingService = new GeocodingService();
