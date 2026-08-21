// © 2026 김용현
/**
 * 인천데이터포털 카탈로그 — **서버 전용**.
 *
 * 인천은 서울·경기와 달리 **API마다 '활용신청'을 따로** 해야 한다(공공데이터포털 방식).
 * 신청하지 않은 API는 같은 인증키로 불러도 `707` 로 거부된다.
 * 포털 전체를 훑어보면 자체 OpenAPI 는 7종(호출주소 8개)뿐이고,
 * 나머지 34종은 SHEET 라 OpenAPI 가 없다. 목록에 보이는 4,300여 건은
 * 공공데이터포털에서 재게시한 것이라 인천 인증키로는 부를 수 없다.
 *
 * 응답 봉투가 두 가지다 (실측, 2026-08-21)
 *   성공: { data: [ … ], message: 'Success' }
 *   오류: { code, msg, host, result: null }
 *
 * 쪽 번호(`pageNo`)는 **0부터**다. 1을 넣으면 빈 배열이 온다.
 * 한 번에 전부 내려주므로 `fixed` 로 0쪽만 부른다.
 */

export const INCHEON_CATALOG = [
  {
    id: 'incheon-library',
    provider: 'incheon',
    name: '인천 도서관',
    description: '인천광역시 도서관 위치와 장서 수·열람석 현황',
    endpoint: 'https://data.incheon.go.kr',
    service: '/openapi/LBRRY/LBRRY',
    params: [],
    // pageNo 는 필수라 빠지면 706 이 온다. 0쪽에 전부 들어온다(65건).
    fixed: { pageNo: '0' },
    path: 'data',
    lon: 'LOT',
    lat: 'LAT',
    epsg: 4326,
    label: 'LBRRY_NM',
    numeric: [
      'BOOK_CNT',            // 장서 수
      'NONBK_CNT',           // 비도서 수
      'CTNU_PBLCTN_CNT',     // 연속간행물 수
      'PRSL_SEAT_CNT',       // 열람석 수
      'LOAN_PSBLTY_VLMCNT',  // 대출 가능 권수
      'LOAN_PSBLTY_DCO'      // 대출 가능 일수
    ],
    srcCategory: '교육'
  },
  {
    id: 'incheon-bike-rack',
    provider: 'incheon',
    name: '인천 자전거보관소',
    description: '인천광역시 자전거보관소 위치와 수용 대수·설치 형태',
    endpoint: 'https://data.incheon.go.kr',
    service: '/openapi/BCYCL_DPSTRY/BCYCL_DPSTRY',
    params: [],
    pageParam: 'pageNo',
    maxRows: 100,   // numOfRows 를 줘도 무시하고 100건씩 준다
    maxPages: 15,   // 1,410건 전량
    path: 'data',
    lon: 'WSG84_LOT',   // 포털 표기가 WGS 가 아니라 WSG 다 (원문 그대로)
    lat: 'WSG84_LAT',
    epsg: 4326,
    label: 'BCYCL_DPSTRY_NM',
    numeric: ['CSTDY_CNTOM'],   // 수용 대수
    srcCategory: '교통물류'
  },
  {
    id: 'incheon-tour-stay',
    provider: 'incheon',
    name: '인천투어 — 숙박',
    description: '인천 관광 숙박시설 위치와 이용 안내',
    endpoint: 'https://data.incheon.go.kr',
    service: '/openapi/ITOUR/ACMDT_INTRCN',
    params: [],
    pageParam: 'pageNo',
    maxRows: 100,
    maxPages: 4,   // 358건 전량
    path: 'data',
    lon: 'MAP_LOT',
    lat: 'MAP_LAT',
    epsg: 4326,
    label: 'CONTS_TTL',
    numeric: [],
    srcCategory: '문화관광'
  },
  {
    id: 'incheon-tour-leisure',
    provider: 'incheon',
    name: '인천투어 — 레포츠',
    description: '인천 레저·체험 시설 위치와 이용 안내',
    endpoint: 'https://data.incheon.go.kr',
    service: '/openapi/ITOUR/LPRT_INTRCN',
    params: [],
    pageParam: 'pageNo',
    maxRows: 100,
    maxPages: 3,   // 246건 전량
    path: 'data',
    lon: 'MAP_LOT',
    lat: 'MAP_LAT',
    epsg: 4326,
    label: 'CONTS_TTL',
    numeric: [],
    srcCategory: '문화관광'
  }
];
