# Seabird — AI eyes on every ocean

해양 실시간 인텔리전스 플랫폼. AIS 선박 데이터와 5개 AI 에이전트가 결합된 해커톤 프로젝트.

> **CLAUDE.md 관리 원칙**: 파일 추가·삭제·기능 변경이 있을 때마다 이 문서를 업데이트한다.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Vite 6 + React 18 + Tailwind CSS v3 |
| 상태관리 | Zustand 5 |
| 차트 | Recharts 3 (통계 대시보드) |
| 지도 | Mapbox GL JS v3 (dark-v11 스타일) |
| AI | Claude API (서버에서 호출 — Haiku/Sonnet 티어화) |
| DB / Realtime | Supabase (PostgreSQL + Realtime) |
| 백엔드 | Node.js + Express + ws (포트 3001) |
| AIS 데이터 | aisstream.io WebSocket (전 세계 BoundingBox) |
| 뉴스 검색 | Perplexity API (영문 검색 → Claude 한국어 번역) |
| 날씨 | Open-Meteo API (무료, 키 불필요 — 해역별 날씨코드·풍속) |
| 원자재/운임 | Perplexity API (가격 검색 → Claude 구조화) |

---

## 디렉토리 구조

```
seabird/
├── CLAUDE.md
├── supabase_schema.sql
├── seabird_characters.xlsx    ← 캐릭터 45개 + 이미지 생성 프롬프트 (AI 이미지 제작용)
├── index.html
├── vite.config.js / tailwind.config.js / postcss.config.js
├── package.json               ← 프론트엔드 의존성
├── .env.local                 ← 프론트엔드 환경변수 (git 제외)
│
├── public/
│   └── characters/            ← 캐릭터 이미지 에셋 (45개 WebP, 투명 배경·512px·품질85로 최적화 — 합계 ~0.9MB)
│       ├── ship_container.webp ~ ship_other.webp  (선박 타입 8개)
│       └── region_suez.webp ~ region_hochiminhcity.webp  (지역 37개)
│
│   ※ image-asset/  ← AI 생성 원본 PNG(1024px, 투명 배경 RGBA). git 제외. scripts/optimize_characters.py로 public/characters/*.webp 생성(알파 보존)
│
├── scripts/
│   └── generate_character_excel.cjs  ← 캐릭터 엑셀 재생성 스크립트
│
├── server/
│   ├── index.js               ← AIS 프록시 + relay + /api/cargo-estimate + /api/ship-track + /api/port-stats + /api/chokepoint-stats + /api/region-news + /api/news + /api/orchestrate + 에이전트 시작
│   ├── package.json
│   ├── .env                   ← 서버 환경변수 (git 제외)
│   ├── agents/
│   │   ├── claudeClient.js    ← Node.js 전용 Claude API 래퍼
│   │   ├── baselineUtils.js   ← 평년(baseline) 산출 공유 정책 resolveBaseline() — 항만·초크포인트 공용
│   │   ├── portAnalyst.js     ← 10분 폴링, Haiku, 30개 항만 combined
│   │   ├── chokepointWatcher.js ← 5분 폴링, Haiku, 7개 초크포인트 combined
│   │   ├── geopoliticalLinker.js ← 15분 폴링, Sonnet, Perplexity 영문검색 → 한국어 번역
│   │   ├── masterAgent.js     ← 10분 폴링, Sonnet, 전체 종합 보고
│   │   ├── weatherAgent.js    ← 30분 폴링, Haiku, Open-Meteo 13개 해역 날씨 → 이모지 마커
│   │   └── commodityAnalyst.js ← 60분 폴링, Haiku, Perplexity 원자재·운임 가격
│   └── data/
│       ├── tradePairs.js      ← 15개 교역 쌍 + 계절 인덱스 (CommonJS)
│       └── destinationNormalizer.js ← destination 정규화 (src/utils/ ESM에서 자동 생성된 CJS 미러)
│
└── src/
    ├── main.jsx
    ├── App.jsx                ← 레이아웃만 (에이전트 시작 코드 없음)
    ├── index.css
    │
    ├── agents/
    │   ├── cargoEstimator.js  ← POST /api/cargo-estimate 호출 (브라우저)
    │   └── orchestrator.js    ← Commander 자연어 → 에이전트 라우팅
    │
    ├── components/
    │   ├── MapView.jsx        ← Mapbox 지도 + 선박 아이콘 + 스타일 토글
    │   ├── MapFilter.jsx      ← 선종별 필터 토글 (8종 + 색상 범례)
    │   ├── PortMarker.jsx     ← 30개 항만 GL 레이어 (circle + symbol, hover 라벨)
    │   ├── ChokepointMarker.jsx ← 7개 초크포인트 HTML 마커 (severity pulse 애니메이션)
    │   ├── WeatherMarker.jsx  ← 날씨 이모지 마커 13개 해역 (WEATHER_AGENT raw_data.points 연동)
    │   ├── RegionIntelPanel.jsx ← 지역 인텔 모달 (Civ7 스타일, 탭: 현황/[선박 동향(항만 전용)]/역사/뉴스, 캐릭터 이미지 지원). 현황=상태 세분화(정박/대기/기동/항행)+평년, 선박 동향=입출항 추정·선종·기국·속력 분포
    │   ├── CommandFeed.jsx    ← 오른쪽 패널 전체
    │   ├── CommanderInput.jsx ← 자연어 입력창
    │   ├── ReportCard.jsx     ← 에이전트 보고 카드 (MASTER_AGENT: 보라색)
    │   ├── ReportModal.jsx    ← 상세 보기 모달
    │   ├── ShipDetailPanel.jsx ← 선박 클릭 상세 (좌측 떠 있는 카드, 캐릭터 헤더 + 3탭: 현황/화물추정/항적). 항적 탭 fetch가 setShipTrack → MapView가 지도에 경로 선+시작/현재 점 표시 + fitBounds
    │   ├── FeedFilter.jsx     ← 에이전트별 필터 토글
    │   ├── StatusBar.jsx      ← 상단 상태 표시줄 (📊 통계 대시보드 토글 버튼)
    │   └── StatsDashboard.jsx ← 통계 대시보드 모달 (Recharts, 8개 섹션)
    │
    ├── hooks/
    │   ├── useAISStream.js    ← ws://localhost:3001/relay 연결 + localStorage 즉시 복원(10분 TTL) + Supabase 선종/국적 보강(enrichFromSupabase: 로드 시 항상 + 3분 주기, updated_at 최신순) + Class B(19/24) 처리 → 지도 선종 색상
    │   └── useAgentReports.js ← Supabase Realtime 구독 (에이전트 보고 수신)
    │
    ├── store/
    │   └── useStore.js        ← Zustand 전역 상태
    │
    ├── utils/
    │   ├── claudeClient.js    ← (현재 미사용 — 에이전트가 서버로 이동됨)
    │   ├── supabaseClient.js  ← Supabase 클라이언트 싱글턴
    │   ├── aisParser.js       ← AIS 메시지 → GeoJSON Feature, mmsiToFlag(MID_TO_FLAG 표준 테이블, server와 동기화), mapAISTypeToCategory. flag는 위치보고에도 채움 → 통계/마커 국적 커버리지 ~100%
    │   ├── destinationNormalizer.js ← AIS destination 자유텍스트 정규화 normalizeDestination()→{country,port,category}. server/data/ 미러(ESM에서 자동 생성)
    │   └── geoUtils.js        ← distanceNm, nmToDeg 등
    │
    └── data/
        ├── regionData.js      ← 37개 지역 데이터 (초크포인트 7 + 항만 30): 캐릭터·통계·역사·newsQuery·image
        ├── shipCharacters.js  ← 선박 타입별 창작 캐릭터 8개 (직함·quote·bgColor·image 경로)
        ├── tradePairs.js      ← (브라우저용 ESM 버전, 현재 미사용)
        └── hardcodedBaselines.js ← (서버 에이전트에 인라인됨)
```

---

## 아키텍처 — 에이전트 데이터 흐름

```
Node.js 서버 (server/index.js)
    ├─ agents/portAnalyst.js      (10분, Haiku)  ─┐
    ├─ agents/chokepointWatcher.js (5분, Haiku)   ├─ Supabase INSERT
    ├─ agents/geopoliticalLinker.js(15분, Sonnet)  │   agent_reports
    ├─ agents/masterAgent.js       (10분, Sonnet)  │
    ├─ agents/weatherAgent.js      (30분, Haiku)   │  ← Open-Meteo 13개 해역
    └─ agents/commodityAnalyst.js  (60분, Haiku) ──┘  ← Perplexity 원자재·운임
                                                    ↓ Realtime
브라우저 (useAgentReports.js)          ←── Supabase Realtime 구독
    → addReport() → 피드 카드 표시
    → WEATHER_AGENT 보고는 raw_data.points → setWeatherMarkers() → 지도 이모지 마커

CARGO ESTIMATOR (선박 클릭)
브라우저 → POST /api/cargo-estimate → 서버 → Claude Haiku(기본, CARGO_MODEL로 오버라이드) → JSON 응답
(선박 종류별 전용 프롬프트: 탱커/LNG/벌크/어선/여객/특수선/컨테이너)

REGION INTEL (항만·초크포인트 클릭 → RegionIntelPanel)
브라우저 → GET /api/port-stats?portId={id} 또는 /api/chokepoint-stats?cpId={id}
        → 서버가 ships 테이블(최근 1h updated_at)을 BoundingBox 집계 → 실시간 현황 vs 평년 게이지
        → port-stats는 한 번에 status_breakdown(상태 세분화)·traffic(입출항 추정)·speed_hist·avg_draught·dest_country_dist(목적지 국가, destination 정규화)까지 반환
          (현황 탭 + 선박 동향 탭이 같은 응답을 공유, 탭 전환 시 추가 요청 없음)
※ destination은 자유텍스트라 파편화 심함(LOCODE/항구명/작업명 혼재) → `destinationNormalizer.normalizeDestination`으로 국가·항구 분류. 코드류(LOCODE)·주요 항구·군소 지역항(NL/NO/DE 내륙항 등)·국가명 단어를 분류하고 나머지 긴 꼬리는 'unknown'(원문 표시). 국가 식별 ~56%(샘플 기준), 상위 빈도 목적지는 대부분 분류됨. ※ 5자 LOCODE 휴리스틱은 드물게 일반 단어를 오분류할 수 있어, COUNTRY_NAMES(국가명)를 먼저 검사.
브라우저 → (뉴스 탭) GET /api/region-news?id={id}&type={type} → Perplexity 영문 검색 → Claude 한국어 번역
※ 실시간 현황이 전부 0이면 ships 테이블에 신선한 행이 없다는 뜻 — upsert 실패(아래 nav_status 이슈) 또는 AIS 커버리지 공백을 의심.
※ 상태/입출항 파생 지표는 nav_status·destination이 aisstream 무료 티어에서 거의 비어 있어(각 0%·~3%) 100% 채워지는 speed·heading(COG)으로 추정한다: 상태=속력대 구간(정박<0.5 / 대기≤2 / 기동<5 / 항행≥5kn), 입출항=항행 중(≥3kn) 선박의 COG가 항구 중심을 향하면 입항·반대면 출항.

SHIP TRACK (선박 클릭 → 항적 탭)
브라우저 → GET /api/ship-track?mmsi={mmsi} → 서버(service_role) → ship_positions 조회 → { positions: [...] }
※ ship_positions는 anon RLS가 모든 행을 차단(정책이 정상인데도 0행)하므로, 반드시 서버(service_role) 경유로 읽는다. 브라우저에서 직접 supabase 조회 금지.
```

**핵심**: 에이전트는 서버에서만 실행. 브라우저는 Supabase Realtime으로 수신.

---

## 아키텍처 — AIS 데이터 흐름

```
aisstream.io WebSocket (전 세계 BoundingBox: [[-90,-180],[90,180]])
    구독 MessageTypes: PositionReport(1/2/3) + ShipStaticData(5)
                     + ExtendedClassBPositionReport(19) + StaticDataReport(24)  ← Class B 소형선 선종 확보
    ↓ (단일 연결, server/index.js)
Node.js 서버 (포트 3001)
    ├─ WebSocket relay → 브라우저 (ws://localhost:3001/relay)
    ├─ shipState(누적 캐시) → 30초 배치 → Supabase ships 테이블 upsert
    │   수집 필드: mmsi, lat, lng, speed, heading, course, nav_status,
    │             ship_name, vessel_type, destination, eta, draught,
    │             call_sign, imo, flag_country
    └─ 10초마다 → ship_positions INSERT
```

> **shipState 누적 캐시 (중요)**: 과거엔 30초 버퍼를 통째로 비우고 이질적 행을 한 배치로 upsert해, 위치-only 갱신이 PostgREST 컬럼 합집합 규칙으로 `vessel_type`/`ship_name`을 NULL로 덮어써 정적 데이터가 수일간 ~3%에 정체됐다. 지금은 mmsi별 **누적 상태를 메모리에 유지**하고, 변경분만 **모든 컬럼을 정규화(동일 키)** 해 upsert하므로 한 번 받은 선종·선명이 보존된다. `shipState`는 6시간 미수신 시 evict.
> **flag는 MMSI MID로 결정** (`MID_TO_FLAG` 표준 테이블). 모든 PositionReport에 채우고, `/api/port-stats`는 저장값이 없으면 mmsi에서 즉시 계산 → 기존 행도 커버. (vessel_type은 정적 메시지에만 있어 누적이 필요.)

---

## 7개 AI 에이전트

에이전트는 **서버(server/agents/)** 에서 실행됨. 모델 티어화로 비용 최적화.

| 에이전트 | 파일 | 모델 | 트리거 | 동작 |
|----------|------|------|--------|------|
| PORT ANALYST | `server/agents/portAnalyst.js` | claude-haiku-4-5 | 10분 폴링 | 30개 항만 combined, 항상 보고 |
| CHOKEPOINT WATCHER | `server/agents/chokepointWatcher.js` | claude-haiku-4-5 | 5분 폴링 | 7개 초크포인트를 **단일 호출**로 묶어 분석(reports 배열) → 초크포인트별 보고 행 저장. dedup 통과분만 분석, 전부 dedup 시 호출 0회 |
| GEOPOLITICAL LINKER | `server/agents/geopoliticalLinker.js` | claude-sonnet-4-6 | 15분 폴링 | Perplexity 영문검색 → Claude 한국어 번역 |
| MASTER AGENT | `server/agents/masterAgent.js` | claude-sonnet-4-6 | 10분 폴링 | 전체 종합, 긴급 시 에이전트 재실행 |
| WEATHER AGENT | `server/agents/weatherAgent.js` | claude-haiku-4-5 | 30분 폴링 | Open-Meteo로 13개 해역 날씨 수집 → 이모지·심각도 마커 + 악천후 보고. 항상 보고 |
| COMMODITY ANALYST | `server/agents/commodityAnalyst.js` | claude-haiku-4-5 | 60분 폴링 | Perplexity로 원자재·운임 가격 검색 → 구조화 data_points + 한국어 시황 |
| CARGO ESTIMATOR | `src/agents/cargoEstimator.js` | claude-haiku-4-5 (기본, `CARGO_MODEL` 환경변수로 오버라이드) | 선박 클릭 | 선박 종류별 전용 프롬프트, vessel_type 변경 시 자동 재실행. 응답 ~24s(Sonnet)→~13s(Haiku) |

### 에이전트 시작 지연 (server/index.js)
서버 시작 3초 후 500ms 간격 stagger:
- 3000ms: CHOKEPOINT WATCHER
- 3500ms: PORT ANALYST
- 4000ms: GEOPOLITICAL LINKER
- 5000ms: BASELINES WRITER
- 5500ms: WEATHER AGENT
- 6000ms: COMMODITY ANALYST

> 새 에이전트 추가 체크리스트: ① `server/agents/<name>.js` (run/start export) → ② `server/index.js` import + setTimeout stagger → ③ 프론트 3곳 등록: `FeedFilter.jsx` AGENT_OPTIONS, `ReportCard.jsx` AGENT_CONFIG, `useStore.js` feedFilters.agents 기본값.

### 날씨 이모지 마커
WEATHER_AGENT는 13개 해역(초크포인트 7 + 태풍다발 해역 6)의 Open-Meteo 현재 날씨를 WMO 코드→이모지, 돌풍(m/s)→심각도(INFO/WARNING/CRITICAL)로 변환해 `raw_data.points`에 담아 보고. 폭풍급 돌풍(≥28m/s)은 🌀로 강조. 프론트는 `useAgentReports`가 최신 WEATHER_AGENT 보고의 points를 `setWeatherMarkers()`로 store에 넣고, `WeatherMarkers` 클래스(mapboxgl.Marker)가 지도에 렌더. Open-Meteo는 **API 키 불필요**.

---

## 지역 데이터 (regionData.js)

총 37개 지역 — 초크포인트 7개 + 항만 30개.

**초크포인트 (7)**: suez, malacca, hormuz, panama, dover, korea_strait, bab_el_mandeb

**항만 (30)**: busan, incheon, gwangyang, singapore, shanghai, rotterdam, la_lb, dubai,
yokohama, kobe, ningbo, shenzhen, hongkong, vladivostok, portklang, mumbai,
hamburg, newyork, guangzhou, qingdao, tianjin, antwerp, tanjung_pelepas,
xiamen, kaohsiung, laem_chabang, jakarta, colombo, savannah, hochiminhcity

각 지역은 `{ type, character, stats, history, newsQuery }` 구조.
캐릭터는 **해당 국가 역사 인물**이어야 함 (타국 인물 사용 금지).
`character.image` 필드: `/characters/region_{id}.webp` (투명 배경) — 파일 없으면 `flagEmoji`로 fallback.

---

## 선박 캐릭터 (shipCharacters.js)

선박 타입별 **창작 아케타입 캐릭터** 8개. 역사 인물 아님, 인종·성별 밸런스 고려.

| vessel_type | 캐릭터 (한국어) | 직함 | 이미지 |
|-------------|---------------|------|--------|
| Container Ship | 박서연 | 글로벌 컨테이너 선단 선장 | ship_container.webp |
| Tanker | 카림 알-라시드 | 원유 탱커 수석 엔지니어 | ship_tanker.webp |
| Bulk Carrier | 아마두 디알로 | 벌크선 화물장 | ship_bulk.webp |
| LNG Carrier | 소피아 베르그 | LNG 안전관제 책임자 | ship_lng.webp |
| Passenger | 아르준 메타 | 크루즈 선장 | ship_passenger.webp |
| Fishing | 마리아 산토스 | 원양어선 선장 | ship_fishing.webp |
| Special Craft | 후안 카레라 | 해양 구조·특수 작전 지휘관 | ship_special.webp |
| Other | 아이나 오베르그 | 미지 항로 항법사 | ship_other.webp |

이미지 생성 프롬프트: `seabird_characters.xlsx` 참조. 생성 후 `public/characters/`에 배치.

---

## Cargo Estimator 선박 종류별 프롬프트

`server/index.js` `/api/cargo-estimate` 엔드포인트에서 `vessel_type`에 따라 분기:

| vessel_type | 추정 내용 |
|-------------|----------|
| Tanker | 원유·석유제품·화학물질·식용유, VLCC/Suezmax/Aframax 사이즈 |
| LNG Carrier | LNG 적재량(m³), 출처국 추정 |
| Bulk Carrier | 철광석·석탄·곡물, Capesize/Panamax 사이즈 |
| Fishing | 어획량 추정, 상업 화물 없음 |
| Passenger | 탑승객 수 추정, 상업 화물 없음 |
| Special Craft | 선박 기능 추정, 상업 화물 없음 |
| Container Ship / Other | TEU + 품목별 화물 분포 |

**우선순위**: fallback(브라우저)의 vessel_type이 non-Other이면 DB 값보다 우선 적용.

**캐싱**: 동일 `(mmsi + destination + vessel_type)` 조합은 `agent_reports`(agent_id=`CARGO_ESTIMATOR`)에 12시간 TTL로 캐시. 캐시 히트 시 Claude 호출 없이 즉시 응답하며, 신규 추정은 백그라운드로 저장(응답 지연 없음).

---

## 통계 대시보드 (StatsDashboard.jsx)

상단 StatusBar의 📊 통계 버튼으로 토글 (`useStore.showStatsDashboard` / `toggleStatsDashboard`). Recharts 기반 모달, 8개 섹션:

1. **KPI 카드 4개** — 추적 선박 수 / CRITICAL 경보 수 / 최고 혼잡 항만 / 위험 초크포인트
2. **선종 분포** — 도넛 차트 (MapFilter와 동일 색상)
3. **기국 Top 10** — 가로 막대 (국기 이모지)
4. **속력 분포** — 히스토그램 (정박·저속·항행·쾌속·고속)
5. **항행 상태 분포** — 도넛 차트 (`nav_status` 기반)
6. **초크포인트 통과량 vs 기준값** — 심각도별 색상 그룹 막대
7. **에이전트 경보 타임라인** — 24시간 스택 막대 (CRITICAL/WARNING/INFO)
8. **목적지 Top 15 + 선종 드릴다운** — destination을 `normalizeDestination`으로 정규화해 파편화(NLRTM/NL RTM/ROTTERDAM→로테르담) 통합, 막대 클릭 시 선종 드릴다운
9. **목적지 국가 Top 10** — destination 정규화 후 국가 단위 집계

데이터 출처: 현재 선박은 store, 초크포인트·경보는 `agent_reports` Supabase 조회.

---

## 환경변수

### 프론트엔드 (`.env.local`)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_MAPBOX_TOKEN=pk.eyJ...
VITE_PROXY_URL=http://localhost:3001   # 배포(Vercel): https://seabird.onrender.com
# VITE_ANTHROPIC_API_KEY 불필요 — 에이전트가 서버에서 실행됨
```

### 서버 (`server/.env`)

```env
AISSTREAM_API_KEY=...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEWSAPI_KEY=...
ANTHROPIC_API_KEY=sk-ant-...   ← 에이전트가 서버에서 사용
PERPLEXITY_API_KEY=pplx-...    ← 지역 뉴스 영문 검색용
PORT=3001
```

---

## 실행 방법

```bash
# 의존성 설치 (최초 1회)
npm install
cd server && npm install && cd ..

# 개발 서버 (동시 실행 권장)
npm run dev:all

# 개별 실행
npm run dev       # Vite 프론트엔드 → http://localhost:5173
npm run server    # Node.js 서버 → http://localhost:3001

# 프로덕션 빌드
node_modules/.bin/vite build   # npx vite 사용 금지 (vite@8 설치 문제)
```

---

## Supabase 스키마

| 테이블 | 용도 |
|--------|------|
| `ships` | AIS 현재 위치 캐시 (PK: mmsi, 30초 배치 upsert) |
| `ship_positions` | AIS 위치 이력 (2시간 TTL) |
| `agent_reports` | 에이전트 보고 카드 (Realtime 활성화, anon 읽기 허용) |
| `baselines` | 항만/초크포인트 수치 스냅샷 (시계열 누적) |

### ships 테이블 주요 컬럼

```sql
mmsi, ship_name, vessel_type, lat, lng, speed, heading, course,
nav_status,      -- AIS NavigationStatus (0=항행, 1=정박, 5=계류 등)
eta,             -- 목적지 도착 예정 시각
draught, max_draught, dwt, destination,
flag_country, imo, call_sign, origin_country, dest_country, updated_at
```

> `nav_status` 컬럼은 초기 스키마에 없음 — 아래 마이그레이션 필요 (seabird Supabase에는 2026-06-13 적용 완료):
> ```sql
> ALTER TABLE ships ADD COLUMN IF NOT EXISTS nav_status SMALLINT;
> ```
> ⚠️ 이 컬럼이 없으면 서버 upsert 페이로드에 `nav_status`가 포함돼 **ships upsert 배치 전체가 매번 실패**한다(`Could not find the 'nav_status' column`). 그 결과 ships 테이블이 갱신되지 않아 지도(relay 경유)는 멀쩡해 보여도 `/api/port-stats`·`/api/chokepoint-stats`의 "실시간 현황 vs 평년"이 전부 0으로 나온다. 새 Supabase 프로젝트로 옮길 때 반드시 먼저 실행.

---

## 알려진 이슈 / 주의사항

1. **mapbox-gl 번들 크기**: 프로덕션 빌드 시 ~2.3MB 경고. 해커톤 범위에서는 무시.
2. **heading=511**: AIS 미수신값. `aisParser.js`에서 `null`로 처리.
3. **에이전트 초기 CRITICAL 보고**: 서버 시작 직후 AIS 데이터가 적어 초크포인트 통과량이 0으로 집계됨. 30분~1시간 후 안정화.
4. **MASTER_AGENT 중복 실행**: 시작 시 직전 서버에서 저장된 CRITICAL 보고를 감지해 에이전트를 재실행하는 것은 정상 동작.
5. **Render 콜드 스타트**: 무료 티어는 15분 비활성 후 슬립. UptimeRobot으로 30분마다 헬스체크 핑 설정 권장.
6. **ships 테이블 미생성 시 선박 미표시**: `supabase_schema.sql` 전체를 Supabase SQL Editor에서 실행해야 함. `agent_reports`만 있고 `ships`가 없으면 지도에 선박이 나타나지 않음.
7. **호르무즈 등 일부 해역 선박 공백**: aisstream.io 무료 티어는 지상 수신기 기반이라 페르시아만·홍해 등 일부 해역의 커버리지가 제한됨. 제재 회피 AIS 소등 선박은 수신 불가.
8. **PortMarker는 GL 레이어 방식**: HTML 마커(mapboxgl.Marker)가 아닌 GeoJSON circle+symbol 레이어로 구현. 줌/팬 시 지도와 정확히 동기화됨. 초크포인트는 여전히 HTML 마커.
9. **ship_positions anon RLS 차단**: RLS 정책이 정상(PERMISSIVE SELECT public)인데도 anon 키로는 0행만 반환됨(원인 미상). 그래서 항적은 브라우저 직접 조회가 아니라 `GET /api/ship-track`(서버 service_role)로 읽는다.
10. **HTML 마커 애니메이션 주의**: mapboxgl.Marker 엘리먼트의 `transform`은 Mapbox가 위치 고정에 사용하므로, CSS 애니메이션에서 `transform`(rotate/translate 등)을 마커 엘리먼트에 직접 걸면 줌/팬 시 위치 이탈. 애니메이션은 내부 자식 엘리먼트에 적용할 것(WeatherMarker의 `.weather-emoji` 패턴). `box-shadow`만 쓰는 초크포인트 마커는 무관.
11. **AIS 유휴 워치독**: aisstream WebSocket이 half-open(좀비)되면 `close`가 안 떠 재연결이 안 됨 → 서버가 조용히 수신 중단. `index.js`가 60초 무수신 시 소켓을 강제 종료해 재연결한다.
12. **Render 배포 시 Supabase 키**: `seabird-server`의 `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL`(render.yaml에서 `sync:false`)을 Render 대시보드에 **로컬 `server/.env`와 동일하게** 설정해야 함. 키가 잘못되면 서버의 모든 Supabase 작업이 `{"error":"Invalid API key"}`로 실패(항적·DB 쓰기 전부 불가)하나, AIS relay와 프론트 anon 읽기는 동작해 증상이 가려짐.
13. **초크포인트 "통과 선박"은 통항량이 아니라 스냅샷**: `/api/chokepoint-stats`·`chokepointWatcher`의 카운트는 "해당 bbox 안에 최근 1h 내 위치가 잡힌 선박 수"(순간 스냅샷)이지, 1시간 동안 통과한 누적 통항량이 아니다. 그래서 bbox 크기·AIS 커버리지에 따라 절대값이 크게 다르다(말라카 큰 박스 = 수백, 호르무즈 무수신 ≈ 0).
14. **평년(baseline) 산출 정책 — `agents/baselineUtils.js` `resolveBaseline(db, locationId, metric, hardcoded)`**: 항만·초크포인트 공용 헬퍼. `baselines`의 해당 metric 이력에서 **0 스냅샷(수집 공백)을 제외**한 실측 표본이 **48개 이상 + 24h 이상 분포**할 때만 그 평균을 동적 평년으로 쓰고, 그 전엔 하드코딩 기준값(초크포인트: 수에즈 58·말라카 247 등 / 항만: 부산 12·싱가포르 45 등)을 쓴다. **4곳이 동일 정책 공유** — `/api/chokepoint-stats`·`chokepointWatcher`(metric=`daily_throughput`), `/api/port-stats`·`portAnalyst`(metric=`waiting_ships`). (과거: 동적 `avg_90d`가 마이그레이션 이전 0들로 오염돼 평년이 0.1~16.5로 나오고, 항만은 패널=하드코딩/에이전트=오염 avg_90d로 따로 놀던 버그를 이 정책으로 통일·차단. `baselinesWriter`의 `avg_90d` 컬럼은 이제 소비되지 않고 이력 기록용.)
15. **에이전트 Claude JSON 견고성 — `agents/claudeClient.js`**: `callClaude`가 응답 JSON을 추출할 때 객체(`{}`)·배열(`[]`) 모두 지원, 코드펜스·후행콤마 제거, 파싱 실패 시 누락 콤마(`}{`→`},{`) 보정, 그래도 실패하면 **1회 재시도**(429/5xx·네트워크·파싱 실패). 또한 `max_tokens`가 작으면 큰 마크다운(예: PORT_ANALYST 30개 항만 표, MASTER 5섹션)이 잘려 "Unterminated JSON"이 나므로 충분히 잡음 — portAnalyst 4000, chokepointWatcher 6000, masterAgent 3000. 과거엔 배열 미지원+토큰 부족으로 PORT/CHOKEPOINT 보고가 주기적으로 유실됐다.
16. **보고 카드 중복 key 방지 — `useStore.addReport`**: 초기 로드(50건) + Realtime 구독 + React StrictMode 이중 마운트로 같은 `agent_reports` 행이 중복 추가돼 React "duplicate key" 경고가 대량 발생했음 → `addReport`가 동일 `id` 존재 시 무시. (브라우저 콘솔 점검은 헤드리스 Chrome+CDP로 가능: 단 WebGL이 없으면 Mapbox가 죽으므로 `--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`로 SW 렌더 활성화 필요.)
17. **WebGL 미지원 폴백 — `MapView.jsx`**: 에러 바운더리가 없어, WebGL 비활성 브라우저에서 Mapbox 초기화 실패 시 앱 전체가 흰 화면이 됐음 → `new mapboxgl.Map`을 try/catch로 감싸 실패 시 안내 오버레이 표시(`mapError`). `map.on('error')`로 비치명적 타일 에러 콘솔 스팸도 억제.
18. **지도 선박 색상(선종) 비어 보임 — `useAISStream`**: 라이브 relay PositionReport는 `vessel_type='Other'`로만 들어오고, 과거엔 localStorage 캐시가 신선하면 Supabase 보강을 통째로 생략해 지도가 거의 회색이었음. → `enrichFromSupabase`를 **로드 시 항상 + 3분 주기**로 실행해 서버가 누적한 선종/국적을 지도에 병합(`updated_at` 최신순으로 송신 중 선박과 매칭률↑). Class B 메시지(19/24)도 처리. 효과: 색칠 비율 ~0% → ~55%(무료 티어 선종 수신율 상한 내 최대치). DB 전체 선종 보유율 자체는 ~37%(정적 메시지 희소).

---

## 구현 일정 (7일)

| Day | 목표 | 상태 |
|-----|------|------|
| 1 | 프로젝트 스캐폴드 + AIS 지도 + Supabase 연결 | ✅ 완료 |
| 2 | Command Feed UI + Realtime 보고 카드 | ✅ 완료 |
| 3 | CARGO ESTIMATOR + CHOKEPOINT WATCHER | ✅ 완료 |
| 4 | PORT ANALYST + MASTER AGENT | ✅ 완료 |
| 5 | GEOPOLITICAL LINKER + 서버 사이드 에이전트 이전 | ✅ 완료 |
| 5+ | 30개 항만 확장 + 선종 분류 버그 수정 + RegionIntelPanel + 선박 상세 UI 개선 | ✅ 완료 |
| 5++ | ShipDetailPanel Civ7 리디자인 + 선박·지역 캐릭터 45개 이미지 시스템 구축 | ✅ 완료 |
| 5+++ | 통계 대시보드(Recharts 8섹션) + Cargo 캐시(12h) + localStorage 선박 캐시 | ✅ 완료 |
| 5++++ | WEATHER AGENT(Open-Meteo 날씨 이모지 마커) + COMMODITY ANALYST(Perplexity 원자재·운임 시황) 추가 | ✅ 완료 |
| 6 | Vercel/Render 배포 (프론트 seabird-tau.vercel.app, 서버 seabird.onrender.com) | ✅ 완료 |
| 6+ | 비교 수치 시스템 | 🔲 |
| 7 | 버그픽스 + 데모 시나리오 준비 | 🔲 |
