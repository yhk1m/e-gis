// © 2026 김용현
/**
 * 공공데이터 카탈로그 — **서버 전용**.
 *
 * 엔드포인트와 좌표 필드 매핑은 브라우저로 내보내지 않는다(publicView 참고).
 * 여기 등록된 API만 중계한다. 임의 주소를 열면 서비스키를 숨긴 의미가 사라진다.
 *
 * 등록 기준
 *  - 응답에 위경도(또는 좌표)가 있을 것. 주소만 있는 데이터는 지오코딩이 필요해 범위 밖이다
 *  - https 지원, JSON 응답 가능
 *  - 한 번에 수백~수천 건을 받을 수 있을 것
 *
 * ⚠️ 아래 항목의 path·lon·lat·epsg는 **실제 서비스키로 응답을 받아 교정해야 한다**.
 *    포털 문서와 실제 응답이 다른 경우가 흔하다.
 */

export const CATALOG = [
  {
    id: 'ev-charger',
    provider: 'data.go.kr',
    name: '전기차 충전소',
    description: '지역별 전기차 충전소 위치와 충전기 종류',
    endpoint: 'https://apis.data.go.kr/B552584/EvCharger/getChargerInfo',
    // 학생이 고르는 값. key는 우리 API에서 쓰는 이름, sendAs는 포털이 요구하는 이름.
    params: [
      {
        key: 'sido',
        label: '시도',
        type: 'select',
        sendAs: 'zcode',
        required: true,
        options: [
          { value: '11', label: '서울' }, { value: '26', label: '부산' },
          { value: '27', label: '대구' }, { value: '28', label: '인천' },
          { value: '29', label: '광주' }, { value: '30', label: '대전' },
          { value: '31', label: '울산' }, { value: '36', label: '세종' },
          { value: '41', label: '경기' }, { value: '43', label: '충북' },
          { value: '44', label: '충남' }, { value: '46', label: '전남' },
          { value: '47', label: '경북' }, { value: '48', label: '경남' },
          { value: '50', label: '제주' }, { value: '51', label: '강원' },
          { value: '52', label: '전북' }
        ]
      }
    ],
    // 항상 붙는 고정 파라미터
    fixed: { dataType: 'JSON', pageNo: '1', numOfRows: '1000' },
    path: 'response.body.items.item',
    lon: 'lng',
    lat: 'lat',
    epsg: 4326,
    label: 'statNm',
    numeric: []
  },
  {
    id: 'seoul-bike',
    provider: 'seoul',
    name: '서울 공공자전거 대여소 (실시간)',
    description: '따릉이 대여소 위치와 거치 현황',
    // 서울시는 키와 조건을 경로에 넣는다: /{키}/json/{서비스}/{시작}/{끝}/{조건…}
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'bikeList',
    params: [],
    maxRows: 1000,          // 한 번에 받을 수 있는 상한 (서울시 규격)
    path: 'rentBikeStatus.row',
    lon: 'stationLongitude',
    lat: 'stationLatitude',
    epsg: 4326,
    label: 'stationName',
    numeric: ['parkingBikeTotCnt', 'rackTotCnt']
  }
];

/** id로 항목을 찾는다. 없으면 null */
export function findEntry(id) {
  if (!id) return null;
  return CATALOG.find(entry => entry.id === id) || null;
}

/**
 * 브라우저에 보낼 정보만 골라낸다.
 * 엔드포인트·경로·좌표 필드는 내부 사정이므로 내보내지 않는다.
 */
export function publicView(entry) {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    params: (entry.params || []).map(param => ({
      key: param.key,
      label: param.label,
      type: param.type,
      required: !!param.required,
      options: param.options || undefined
    })),
    label: entry.label,
    numeric: entry.numeric || []
  };
}
