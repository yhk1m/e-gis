// © 2026 김용현
/**
 * 공공데이터 카탈로그 — **서버 전용**.
 *
 * 엔드포인트와 좌표 필드 매핑은 브라우저로 내보내지 않는다(publicView 참고).
 * 여기 등록된 API만 중계한다. 임의 주소를 열면 서비스키를 숨긴 의미가 사라진다.
 *
 * 등록 기준
 *  - 응답에 위경도(또는 좌표)가 있을 것. 주소만 있는 데이터는 지오코딩이 필요해 범위 밖이다
 *  - JSON 응답 가능 (https가 아니어도 된다 — 중계 함수가 서버에서 부르므로)
 *  - 한 번에 수백~수천 건을 받을 수 있을 것
 *
 * ⚠️ 항목을 추가할 때 사람이 해야 하는 절차
 *  - 공공데이터포털: 인증키는 계정당 하나지만 **API마다 '활용신청'을 따로** 해야 한다.
 *    신청하지 않은 API는 같은 키로 불러도 거부된다(우리 쪽 안내: "서비스 접근이 거부되었습니다").
 *    일일 호출 한도도 활용신청 건별로 부여된다.
 *  - 서울열린데이터광장: 인증키 하나로 모든 서비스를 부를 수 있다. 서비스별 신청은 없다.
 *
 * ⚠️ 아래 항목의 path·lon·lat·epsg는 **실제 서비스키로 응답을 받아 교정해야 한다**.
 *    포털 문서와 실제 응답이 다른 경우가 흔하다.
 */

import { SEOUL_CATALOG } from './_catalog.seoul.js';
import { GG_CATALOG } from './_catalog.gg.js';
import { INCHEON_CATALOG } from './_catalog.incheon.js';
import { categoryOf, regionOf } from './_categories.js';
import { SIGUNGU_OPTIONS } from './_sigungu.js';

/** 손으로 다듬은 항목 — 이름·설명·선택지가 정리되어 있어 자동 생성본보다 우선한다 */
const CURATED = [
  {
    id: 'ev-charger',
    provider: 'data.go.kr',
    name: '전기차 충전소',
    description: '지역별 전기차 충전소 위치와 충전기 종류',
    endpoint: 'https://apis.data.go.kr/B552584/EvCharger/getChargerInfo',
    // 학생이 고르는 값. key는 우리 API에서 쓰는 이름, sendAs는 포털이 요구하는 이름.
    //
    // 시도 단위로 물으면 서울만 75,959건인데 한 번에 9,999건까지만 온다 —
    // 늘 잘린다. 시군구로 좁히면 가장 많은 곳도 6,000건 남짓이라 전량이 들어온다.
    params: [
      {
        key: 'sigungu',
        label: '시군구',
        type: 'select',
        sendAs: 'zscode',
        required: true,
        options: SIGUNGU_OPTIONS
      }
    ],
    // 항상 붙는 고정 파라미터
    fixed: { dataType: 'JSON', pageNo: '1', numOfRows: '9999' },   // 이 API 의 한 번 최대치
    // 이 API 는 response 로 감싸지 않고 최상위에 items 를 둔다 (실측, 2026-08-21)
    path: 'items.item',
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
    maxPages: 5,            // 이만큼까지 이어 받는다 (따릉이는 2,700곳쯤 된다)
    path: 'rentBikeStatus.row',
    lon: 'stationLongitude',
    lat: 'stationLatitude',
    epsg: 4326,
    label: 'stationName',
    numeric: ['parkingBikeTotCnt', 'rackTotCnt']
  },
  {
    id: 'seoul-culture',
    provider: 'seoul',
    name: '서울 문화공간',
    description: '공연장·박물관·미술관 등 문화시설 위치 (약 1,000곳)',
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'culturalSpaceInfo',
    params: [],
    maxRows: 1000,
    maxPages: 3,
    path: 'culturalSpaceInfo.row',
    // ⚠️ X_COORD가 위도, Y_COORD가 경도다 (이름과 반대) — 실제 응답으로 확인함
    lon: 'Y_COORD',
    lat: 'X_COORD',
    epsg: 4326,
    label: 'FAC_NAME',
    numeric: []
  },
  {
    id: 'seoul-library',
    provider: 'seoul',
    name: '서울 공공도서관',
    description: '구립·시립 공공도서관 위치 (약 200곳)',
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'SeoulPublicLibraryInfo',
    params: [],
    maxRows: 1000,
    maxPages: 1,
    path: 'SeoulPublicLibraryInfo.row',
    // ⚠️ XCNTS가 위도, YDNTS가 경도다 (이름과 반대)
    lon: 'YDNTS',
    lat: 'XCNTS',
    epsg: 4326,
    label: 'LBRRY_NAME',
    numeric: []
  },
  {
    id: 'seoul-parking',
    provider: 'seoul',
    name: '서울 공영주차장',
    description: '시·구 공영주차장 위치와 주차면수 (약 2,200곳)',
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'GetParkInfo',
    params: [],
    maxRows: 1000,
    maxPages: 4,
    path: 'GetParkInfo.row',
    lon: 'LOT',
    lat: 'LAT',
    epsg: 4326,
    label: 'PKLT_NM',
    numeric: ['TPKCT']   // 총 주차면수 — 격자 합계에 쓸 만하다
  },
  {
    id: 'seoul-park',
    provider: 'seoul',
    name: '서울 공원',
    description: '도시공원 위치와 면적 (약 130곳)',
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'SearchParkInfoService',
    params: [],
    maxRows: 1000,
    maxPages: 1,
    path: 'SearchParkInfoService.row',
    // XCRD_G/YCRD_G(TM)도 있지만 XCRD/YCRD에 위경도가 이미 들어 있다.
    // TM 쪽을 쓰면 남산공원이 760m 어긋난다 — 위경도를 쓴다.
    lon: 'XCRD',
    lat: 'YCRD',
    epsg: 4326,
    label: 'PARK_NM',
    numeric: ['AREA']
  },
  {
    id: 'seoul-wifi',
    provider: 'seoul',
    name: '서울 공공와이파이',
    description: '공공와이파이 설치 지점 (약 26,000곳 — 격자 집계로 보기 좋다)',
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'TbPublicWifiInfo',
    params: [],
    maxRows: 1000,
    maxPages: 30,        // 2만 6천 건이라 27장쯤 된다 (약 3초)
    path: 'TbPublicWifiInfo.row',
    lon: 'LNT',
    lat: 'LAT',
    epsg: 4326,
    label: 'X_SWIFI_MAIN_NM',
    numeric: []
  },
  {
    id: 'seoul-busstop',
    provider: 'seoul',
    name: '서울 버스정류소',
    description: '시내버스 정류소 위치 (약 11,000곳 — 대중교통 접근성 수업용)',
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'busStopLocationXyInfo',
    params: [],
    maxRows: 1000,
    maxPages: 15,        // 1만 1천 건이라 12장쯤 된다
    path: 'busStopLocationXyInfo.row',
    lon: 'XCRD',
    lat: 'YCRD',
    epsg: 4326,
    label: 'STOPS_NM',
    numeric: []
  },
  {
    id: 'seoul-sports',
    provider: 'seoul',
    name: '서울 공공체육시설 예약',
    description: '예약할 수 있는 공공 체육시설·프로그램 (약 600건)',
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'ListPublicReservationSport',
    params: [],
    maxRows: 1000,
    maxPages: 2,
    path: 'ListPublicReservationSport.row',
    lon: 'X',
    lat: 'Y',
    epsg: 4326,
    // 시설이 아니라 '예약 서비스' 한 건이 한 줄이다 — 같은 장소가 여러 번 나온다
    label: 'PLACENM',
    numeric: []
  },
  {
    id: 'seoul-culture-program',
    provider: 'seoul',
    name: '서울 문화체험 프로그램',
    description: '예약할 수 있는 문화체험 프로그램 (약 900건)',
    endpoint: 'http://openapi.seoul.go.kr:8088',
    service: 'ListPublicReservationCulture',
    params: [],
    maxRows: 1000,
    maxPages: 2,
    path: 'ListPublicReservationCulture.row',
    lon: 'X',
    lat: 'Y',
    epsg: 4326,
    label: 'PLACENM',
    numeric: []
  }
];

/**
 * 손질한 항목 + 자동 생성 항목. 같은 서비스가 겹치면 손질한 쪽을 쓴다.
 * 자동 생성본은 서울열린데이터광장 오픈API 1,024건을 훑어 좌표가 확인된 것만 담았다.
 */
const curatedServices = new Set(CURATED.map(entry => entry.service).filter(Boolean));

/**
 * 같은 API를 여러 데이터셋이 가리키는 경우가 있어 id가 겹친다.
 * 먼저 온 것을 남긴다 — 손질본 > 서울 자동생성 > 경기 자동생성 순.
 */
function dedupeById(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

export const CATALOG = dedupeById([
  ...CURATED,
  ...SEOUL_CATALOG.filter(entry => !curatedServices.has(entry.service)),
  ...GG_CATALOG,
  ...INCHEON_CATALOG
]);

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
    category: categoryOf(entry),
    region: regionOf(entry),
    label: entry.label,
    numeric: entry.numeric || []
  };
}
