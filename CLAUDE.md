# Seabird — AI eyes on every ocean

해양 실시간 인텔리전스 플랫폼. AIS 선박 데이터와 9개 AI 에이전트가 결합된 해커톤 프로젝트.

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
| 운임·선가 지수 | KOBC(한국해양진흥공사) 스크래핑 (건화물 KDCI·CAPE·PANAMAX, 컨테이너 KCCI, 신조선가 → freight_history, sDay/eDay로 백필) |
| 투자 인텔리전스 | X CAPITAL — 3 페르소나(Billions 모티프) 데스크가 대안데이터로 투자 아이디어 제시 |

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
│   └── characters/            ← 캐릭터 이미지 에셋 (WebP, 투명 배경·512px·품질85로 최적화). 45개 캐릭터 + 인트로용 Malcolm_McLean.webp·era_*.webp(6 시대 일러스트)
│       ├── ship_container.webp ~ ship_other.webp  (선박 타입 8개)
│       └── region_suez.webp ~ region_hochiminhcity.webp  (지역 37개)
│
│   ※ image-asset/  ← AI 생성 원본 PNG(1024px, 투명 배경 RGBA). git 제외. scripts/optimize_characters.py로 public/characters/*.webp 생성(알파 보존)
│
├── scripts/
│   ├── generate_character_excel.cjs  ← 캐릭터 엑셀 재생성 스크립트
│   └── generate_region_characters.cjs ← regionData.js(ESM)에서 캐릭터 페르소나만 추출 → server/data/regionCharacters.js(CJS) 미러 생성 (history 제외)
│
├── server/
│   ├── index.js               ← AIS 프록시 + relay + /api/cargo-estimate + /api/ship-track + /api/port-stats + /api/chokepoint-stats + /api/baseline-history + /api/change-windows + /api/inflow-windows + /api/comparison-board + /api/xcap/desks + /api/xcap/freight + /api/xcap/desk-series + /api/region-news + /api/news + /api/orchestrate + 에이전트 시작 (통계 GET 60초 캐시·comparison-board 단일쿼리·dwell_events 180일 TTL 정리). **보안 미들웨어**: CORS allowlist(ALLOWED_ORIGINS)·express-rate-limit 2단계(전역 apiLimiter + 유료 paidLimiter)·express.json 64kb·trust proxy·relay WS 연결 상한 → SECURITY.md
│   ├── package.json
│   ├── .env                   ← 서버 환경변수 (git 제외)
│   ├── agents/
│   │   ├── claudeClient.js    ← Node.js 전용 Claude API 래퍼
│   │   ├── baselineUtils.js   ← 평년(baseline) 산출 공유 정책 resolveBaseline()/resolveBaselineStats(mean·std·n·latest·series + **roll{ma7,ma30,wow7,mom30,z}·smoothedCurrent·smoothedChangePct**) + rollingFromSamples() export — 항만·초크포인트·X CAPITAL 공용. 보고는 순간값 아닌 7일/30일 이동평균 기준(단일 시점 과대반응 차단)
│   │   ├── trafficAggregator.js ← 항만·초크포인트 실시간 집계 공유 모듈 aggregatePort()/aggregateChokepoint() — 선종·기국·목적지·입출항(선종별)·원자재 유입 추정(estLadenTons). port-stats·chokepoint-stats·baselinesWriter 공용
│   │   ├── portAnalyst.js     ← 3시간 폴링, Haiku, 항구별 대표 캐릭터가 1인칭으로 자기 항구 현재 상황 보고(항구당 1행). 데이터 있는 항구만(0척 skip), 재시작 중복 방지(최근 50분 내 skip), 동시성 5. **change_pct·data_points는 7일 평균(smoothedCurrent) 기준 + raw_data에 wow/mom/z** (순간 스냅샷 과대반응 차단)
│   │   ├── chokepointWatcher.js ← 3시간 폴링, Haiku, 초크포인트별 대표 캐릭터 1인칭 통항 보고(초크포인트당 1행). 0척 skip(거짓 CRITICAL 방지), raw_data.cp_id·change_pct·location.chokepoint_id 보존(마커·StatusBar 소비). **change_pct는 7일 평균 기준 + raw_data에 wow/mom/z**
│   │   ├── geopoliticalLinker.js ← 3시간 폴링, Sonnet, Perplexity 영문검색 → 한국어 번역
│   │   ├── masterAgent.js     ← 3시간 폴링, Sonnet, **유일하게 severity(WARNING/CRITICAL)를 판단하는 에이전트**. 최근 3.5시간 하위 '사실' 보고를 종합(data_points 현재값·평년·change_pct + 상관관계)해 위험도 결정. index.js에서 +120초 후 기동(첫 배치 적재 대기)
│   │   ├── weatherAgent.js    ← 3시간 폴링, Haiku, Open-Meteo 13개 해역 날씨 → 이모지 마커
│   │   ├── commodityAnalyst.js ← 3시간 폴링, Haiku, Perplexity 원자재·운임 가격
│   │   ├── flowReporter.js    ← 3시간 폴링, Haiku, traffic_snapshots 이력 → 항만 원자재 유입 추세(DoD)
│   │   ├── kobcScraper.js     ← 12시간 폴링, KOBC gridList.do(sDay/eDay 백필) HTML 파싱 → freight_history 적재. drybulk(kdci/gridList.do, KDCI·CAPE·PANAMAX·SUPRAMAX·HANDY)·container(timeseries/gridList.do?mId=0304, KCCI 종합)·shipprice(sln/gridList.do 신조선가)
│   │   ├── xcapData.js        ← X CAPITAL 데스크 집계 공유 모듈 buildAllDesks()/buildDeskSeries()/dwellSignals()/lagCorrelation()/freightSeries(). 3 데스크(axelrod/taylor/wagner) 정량 신호 + dwell(체류시간) 신호 + 지표별 mode 플래그(live/estimate/demo). buildDeskSeries=데스크 전 항구 합산 일별 시계열(혼잡·입항·유입·체류·운임, /api/xcap/desk-series). /api/xcap/* + investmentAnalyst 공용
│   │   ├── tankerScraper.js   ← BDTI(발틱 더티탱커) 운임 → freight_history(Wagner 정유 데스크). investing.com은 서버 Cloudflare 403이라 best-effort+demo 폴백. env BDTI_FETCH_URL(프록시)로 라이브 가능
│   │   ├── korPortStats.js    ← 해양수산부 공공데이터(data.go.kr) 월별 공식 통계 → kor_port_monthly. SsopVsslEtryndHarbor2(항만별 입출항, per-port)·SsopCargFrghtPrdlst2(품목별 화물처리, 전국). AIS 사각지대 국내 철강·정유항(광양·포항·당진·울산·여수) 보완. env DATA_GO_KR_KEY, 12h 폴링, sym/eym(YYYYMM) 13개월 백필
│   │   ├── gicomsStats.js     ← GICOMS(해양안전종합정보시스템) 연안 AIS WFS → **sea_density_daily(일별)**. lage_ship_stats_view(대해구 격자×일×시 AIS수)를 항구 BBOX(EPSG:3857)로 좁혀 ais 합산=해역 통항 밀집도. env GICOMS_API_KEY+domain=seabird.onrender.com(등록 도메인, 쿼리파라미터). **2026-06-22 GICOMS WFS 수정 → 일별·당일까지(준실시간) 제공**(이전엔 월별·수개월 지연이라 kor_port_monthly에 월 1일만 저장했음). ship_time 2h 제약은 그대로(2h 윈도우 3개 합산), GML 응답. 6h 폴링(최근 35일 백필 + 오늘·어제 재조회). X CAPITAL 카드 '해역밀집'(일별 라인·DoD)
│   │   ├── dwellTracker.js    ← 항만 체류시간 저비용 추적. baselinesWriter 매시 스캔에 올라타 정박·대기(≤2kn) 선박을 port_presence(open ledger)에 upsert(port_presence_touch RPC), 2.5h 미관측 시 dwell_events로 마감. ship_positions(2h TTL) 미사용 → 비용 거의 0. recordPresence/closeStaleVisits/trackPortDwell/cleanupDwellEvents
│   │   ├── investmentAnalyst.js ← 3시간 폴링, Haiku, X CAPITAL 9번째 에이전트. xcapData + 시황 종합 → 페르소나별 투자 시그널. raw_data.desks 병합
│   │   └── baselinesWriter.js ← 60분 적재(데이터 writer — 보고 아님), aggregator로 전 지역 1회 집계 → baselines(스칼라)+traffic_snapshots(분해) 동시 적재 + dwellTracker.trackPortDwell 호출(전 항구 동일 cycleNow 공유) (무료 티어 Disk IO 절약 위해 30→60분)
│   └── data/
│       ├── tradePairs.js      ← 15개 교역 쌍 + 계절 인덱스 (CommonJS)
│       ├── flag.js            ← MID_TO_FLAG(MMSI MID→ISO3)·mmsiToFlag 단일 소스 (index.js·trafficAggregator 공용)
│       ├── destinationNormalizer.js ← destination 정규화 (src/utils/ ESM에서 자동 생성된 CJS 미러)
│       └── regionCharacters.js ← 지역 캐릭터 페르소나 CJS 미러 (regionData.js에서 자동 생성, history 제외 — name·title·quote·role·image). portAnalyst·chokepointWatcher가 1인칭 보고에 사용
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
    │   ├── Sparkline.jsx      ← 경량 SVG 스파크라인 (baselines 시계열 추이 + 평년 기준선, Recharts 없이 인라인). RegionIntelPanel 현황 탭 추이 카드에 사용
    │   ├── RegionIntelPanel.jsx ← 지역 인텔 모달 (Civ7 스타일, 탭: 현황/[선박 동향(항만 전용)]/역사/뉴스, 캐릭터 이미지 지원). 현황=상태 세분화(정박/대기/기동/항행)+평년 게이지+**최근 추이(24h 스파크라인·추세·z-score, /api/baseline-history)**+**증감 윈도우(ChangeWindows: DoD/WoW/MoM/YoY, /api/change-windows — baselines에서 최근24h vs N일전 24h 비교, 이력 없는 윈도우는 '누적 중', WoW↑만 규칙기반 해석·DoD 해석 생략)**, 선박 동향=입출항 추정·**원자재 유입 추정(CommodityInflow: 원유·건화물·컨테이너·LNG)+유입 증감 매트릭스(InflowChangeMatrix: 품목×DoD/WoW/MoM/YoY, /api/inflow-windows — traffic_snapshots 기반)**·선종·기국·목적지 분포
    │   ├── CommandFeed.jsx    ← 오른쪽 패널 전체. 카테고리 탭(FeedTabs)으로 보고를 분류해 표시. base(심각도·기간 필터)→탭별 건수 배지 계산→활성 탭(feedTab)으로 최종 필터
    │   ├── FeedTabs.jsx       ← 카테고리 탭 바 (전체/항구/초크포인트/원자재/날씨/지역/화물). TABS = 탭↔에이전트 매핑 단일 소스(agents:null=전체). reportInTab()으로 보고 분류. 원자재=COMMODITY+FLOW, 지역=GEOPOLITICAL, MASTER_AGENT는 전체 탭에만
    │   ├── CommanderInput.jsx ← 자연어 입력창
    │   ├── ReportCard.jsx     ← 에이전트 보고 카드 (MASTER_AGENT: 보라색)
    │   ├── ReportModal.jsx    ← 상세 보기 모달 (react-markdown + **remark-gfm** → GFM 표 렌더, Notion 스타일 커스텀 components: 테두리 표·여백 제목·리스트. ※ remark-gfm 없으면 표가 깨지고, prose 클래스는 typography 플러그인 미설치라 무효 — 그래서 커스텀 렌더러 사용)
    │   ├── ShipDetailPanel.jsx ← 선박 클릭 상세 (좌측 떠 있는 카드, 캐릭터 헤더 + 3탭: 현황/화물추정/항적). 선택 시 Supabase ships 전체 행 보강(dbShip) → 지도 피처(Other)보다 우선해 **캐릭터·선종·색상 일관성** 확보. 현황 탭: 항행상태 배지(nav_status 우선, 없으면 속력 추정) + 데이터 기반 캐릭터 브리핑(buildNarration: 목적지+선종+속력+상태+ETA) + 목적지(normalizeDestination+17k LOCODE_MAP로 "대만 / 가오슝"식)·흘수·DWT·침로·갱신시각. 항적 탭 fetch가 setShipTrack → MapView 경로 시각화
    │   ├── FeedFilter.jsx     ← 심각도(CRITICAL/WARNING/INFO)·기간(1h~7d) 필터 (에이전트 토글은 FeedTabs로 이동)
    │   ├── StatusBar.jsx      ← 상단 상태 표시줄 (📊 통계 대시보드 토글 버튼)
    │   ├── StatsDashboard.jsx ← 통계 대시보드 모달 (Recharts, 10개 섹션 — 평년 대비 편차 보드 포함, /api/comparison-board)
    │   ├── XCapitalSpace.jsx  ← 💼 X CAPITAL 투자 인텔리전스 풀스크린 공간(office.webp 배경). 3 페르소나 카드(시그널·thesis·정량칩 2×2: 혼잡·유입·체류시간·운임 + 지표별 mode 배지 + "자세히" 버튼) + 선택 데스크 다지표 차트(혼잡·입항·유입·체류·운임, ComposedChart, 지표별 토글 칩 + 지수(시작=100)/원본값 토글, /api/xcap/desk-series로 데스크 전 항구 합산 — 대표항 1곳만 쓰던 차트 버그 수정) + 글로벌 데모/라이브 배지. ModeBadge export(DeskDetailsModal 재사용). /api/xcap/desks·/api/xcap/desk-series + 최신 INVESTMENT_ANALYST 보고(raw_data.desks) 소비. StatusBar 💼 버튼·ESC 토글(자세히 모달 열려 있으면 모달만 닫음)
    │   ├── DeskDetailsModal.jsx ← X CAPITAL "자세히" 모달(z-[60]). 데스크가 쓰는 항구(한글)·운임지수 설명(glossary) + 실수치 시계열 표(최신순, 컬럼별 단위·ModeBadge). /api/xcap/desk-series 자체 fetch(부모 캐시 seed). ReportModal 표 스타일 미러
    │   └── IntroPage.jsx      ← 인트로 오버레이 (문명 게임 스타일, 맬컴 맥린 지도자 + 챕터형 4막: 지도자/역사 기술트리/능력/팁). 첫 방문 자동 1회(localStorage `seabird_intro_seen_v1`) + GNB 📜 인트로 버튼. 이미지 emoji fallback. 콘텐츠는 introContent.js
    │
    ├── hooks/
    │   ├── useAISStream.js    ← ws://localhost:3001/relay 연결 + localStorage 즉시 복원(10분 TTL, 8000척 초과 시 캐시 skip) + Supabase 선종/국적 보강(enrichFromSupabase: 최초 로드=전체 시드 PREFETCH_MAX=50000 **range 페이지네이션**(PostgREST max-rows 1000 우회, 10-wide 병렬 ~5s), 3분 주기=화면 보강+최신 1페이지 top-up, updated_at 최신순) + Class B(19/24) 처리 → 지도 선종 색상. flushBuffer가 `shipOverrides`(선택 선박 dbShip 보강)를 매 500ms 적용 → 클릭 즉시 마커 색상 일치
    │   └── useAgentReports.js ← Supabase Realtime 구독 (에이전트 보고 수신)
    │
    ├── store/
    │   └── useStore.js        ← Zustand 전역 상태
    │
    ├── utils/
    │   ├── supabaseClient.js  ← Supabase 클라이언트 싱글턴
    │   ├── aisParser.js       ← AIS 메시지 → GeoJSON Feature, mmsiToFlag(MID_TO_FLAG 표준 테이블, server와 동기화), mapAISTypeToCategory. flag는 위치보고에도 채움 → 통계/마커 국적 커버리지 ~100%
    │   ├── destinationNormalizer.js ← AIS destination 자유텍스트 정규화 normalizeDestination()→{country,port,category}. server/data/ 미러(ESM에서 자동 생성)
    │   └── geoUtils.js        ← distanceNm, nmToDeg 등
    │
    └── data/
        ├── regionData.js      ← 37개 지역 데이터 (초크포인트 7 + 항만 30): 캐릭터·통계·역사·newsQuery·image
        ├── shipCharacters.js  ← 선박 타입별 창작 캐릭터 8개 (직함·quote·bgColor·image 경로)
        ├── investmentCharacters.js ← X CAPITAL 페르소나 3인 (Billions 모티프: Bobby Axelrod·Taylor Mason·Mike Wagner). key가 서버 xcapData DESKS[].key와 일치(axelrod/taylor/wagner). desk·equities·accent·image(/characters/xcap_*.webp)·strategy(framework 전략 한 줄·reads 데이터 해석법·playbook LONG/SHORT/HOLD 조건 — 자세히 모달의 '전략' 섹션)
        ├── xcapGlossary.js    ← X CAPITAL 자세히/차트용 한글 라벨: PORT_KO(항구 id→한글, regionData는 역사인물명이라 별도)·FREIGHT_GLOSSARY(KCCI/KDCI/CAPE 설명)·SERIES_META/SERIES_ORDER(지표 라벨·색상·축·단위키)
        ├── introContent.js    ← 인트로 페이지 콘텐츠 (MALCOLM 지도자·ERAS 6시대·ABILITIES·TIPS·CHAPTERS). IntroPage.jsx가 소비
        ├── tradePairs.js      ← (브라우저용 ESM 버전, 현재 미사용)
        └── hardcodedBaselines.js ← (서버 에이전트에 인라인됨)
```

---

## 아키텍처 — 에이전트 데이터 흐름

```
Node.js 서버 (server/index.js)
    ├─ agents/portAnalyst.js      (3시간, Haiku) ─┐  ← 항구별 캐릭터 1인칭
    ├─ agents/chokepointWatcher.js (3시간, Haiku) ├─ Supabase INSERT  ← 초크포인트별 캐릭터 1인칭
    ├─ agents/geopoliticalLinker.js(3시간, Sonnet) │   agent_reports
    ├─ agents/masterAgent.js       (3시간, Sonnet) │
    ├─ agents/weatherAgent.js      (3시간, Haiku)  │  ← Open-Meteo 13개 해역
    └─ agents/commodityAnalyst.js  (3시간, Haiku)──┘  ← Perplexity 원자재·운임
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
브라우저 → (현황 탭 추이) GET /api/baseline-history?locationId={id}&metric={waiting_ships|daily_throughput}&hours=24
        → 서버가 baselines 이력(0 스냅샷 제외)에서 series·평년·mean·std·z-score·추세(마지막 3표본 기울기) 반환 → Sparkline + z-score 배지
※ destination은 자유텍스트라 파편화 심함(LOCODE/항구명/작업명 혼재) → `destinationNormalizer.normalizeDestination`으로 국가·항구 분류. 코드류(LOCODE)·주요 항구·군소 지역항(NL/NO/DE 내륙항 등)·국가명 단어를 분류하고 나머지 긴 꼬리는 'unknown'(원문 표시). 국가 식별 ~56%(샘플 기준), 상위 빈도 목적지는 대부분 분류됨. ※ 5자 LOCODE 휴리스틱은 드물게 일반 단어를 오분류할 수 있어, COUNTRY_NAMES(국가명)를 먼저 검사.
브라우저 → (뉴스 탭) GET /api/region-news?id={id}&type={type} → **저장본 우선**(`region_news` 일배치 수집분 즉시 반환·무과금). 미수집 지역만 라이브 폴백(Perplexity 영문 → Claude 번역). regionNewsCollector(매일)가 37개 지역 최근 1주 뉴스를 미리 수집·저장.
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
    │   ※ raw firehose를 1건씩 중계하지 않음. 변경 선박만 **3초마다 compact 배치 스냅샷**(RELAY_FLUSH_INTERVAL_MS env, 기본 3000)
    │     `{type:'snapshot', ships:[{mmsi,lat,lng,speed,heading,nav_status,vessel_type,ship_name,flag_country,destination,eta}]}`
    │     으로 묶어 전송(같은 선박 다중 위치보고는 dedup) + **perMessageDeflate 압축**.
    │     새 탭 접속 시 전체 스냅샷 1회(full:true). raw 중계 대비 Render egress 90%+↓.
    │     의미 있는 필드만 포함(없는 필드는 프론트가 기존값 유지). 보는 클라이언트 0이면 전송 skip.
    ├─ shipState(누적 캐시) → 30초 배치 → Supabase ships 테이블 upsert
    │   수집 필드: mmsi, lat, lng, speed, heading, course, nav_status,
    │             ship_name, vessel_type, destination, eta, draught,
    │             call_sign, imo, flag_country
    └─ ship_positions INSERT (10초 배치 flush, **같은 mmsi는 60초당 1건만** throttle) — 2h TTL, 20분마다 정리
```

> **shipState 누적 캐시 (중요)**: 과거엔 30초 버퍼를 통째로 비우고 이질적 행을 한 배치로 upsert해, 위치-only 갱신이 PostgREST 컬럼 합집합 규칙으로 `vessel_type`/`ship_name`을 NULL로 덮어써 정적 데이터가 수일간 ~3%에 정체됐다. 지금은 mmsi별 **누적 상태를 메모리에 유지**하고, 변경분만 **모든 컬럼을 정규화(동일 키)** 해 upsert하므로 한 번 받은 선종·선명이 보존된다. `shipState`는 6시간 미수신 시 evict.
> **flag는 MMSI MID로 결정** (`MID_TO_FLAG` 표준 테이블). 모든 PositionReport에 채우고, `/api/port-stats`는 저장값이 없으면 mmsi에서 즉시 계산 → 기존 행도 커버. (vessel_type은 정적 메시지에만 있어 누적이 필요.)

---

## 9개 AI 에이전트

에이전트는 **서버(server/agents/)** 에서 실행됨. 모델 티어화로 비용 최적화.

> **severity 정책 (중요)**: WARNING/CRITICAL 판단은 **MASTER_AGENT 전담**이다. 나머지 하위 에이전트(PORT·CHOKEPOINT·WEATHER·COMMODITY·GEOPOLITICAL·FLOW)는 **사실만 보고하며 severity를 항상 `INFO`로 고정**한다(통계·change_pct·data_points는 그대로 담아 마스터의 판단 근거로 제공). 따라서 피드에서 WARNING/CRITICAL 배지는 마스터 종합 보고에서만 나타난다(MASTER는 FeedTabs '전체' 탭). ※ WEATHER의 `raw_data.points[].severity`(돌풍·🌀 등급)는 지도 마커용 기상 사실이라 예외로 유지.

| 에이전트 | 파일 | 모델 | 트리거 | 동작 |
|----------|------|------|--------|------|
| PORT ANALYST | `server/agents/portAnalyst.js` | claude-haiku-4-5 | 3시간 폴링 | **항구별** 대표 캐릭터가 1인칭으로 자기 항구의 현재 운영 상황 보고(항구당 호출 1회·행 1건). 실시간 데이터 있는 항구만(0척 skip), 최근 50분 보고 시 skip(재시작 중복 방지), Claude 동시성 5 |
| CHOKEPOINT WATCHER | `server/agents/chokepointWatcher.js` | claude-haiku-4-5 | 3시간 폴링 | **초크포인트별** 대표 캐릭터가 1인칭으로 통항 상황 보고(초크포인트당 행 1건). 0척 skip(거짓 CRITICAL 방지). `raw_data.cp_id`·`change_pct`·`location.chokepoint_id` 보존(마커·StatusBar 칩 소비) |
| GEOPOLITICAL LINKER | `server/agents/geopoliticalLinker.js` | claude-sonnet-4-6 | 3시간 폴링 | Perplexity 영문검색 → Claude 한국어 번역 |
| MASTER AGENT | `server/agents/masterAgent.js` | claude-sonnet-4-6 | 3시간 폴링 | **유일한 severity 판단자**. 최근 3.5시간 하위 사실 보고를 종합해 WARNING/CRITICAL 결정 + 상관관계·근본원인·한국 공급망 영향. (재실행 로직 제거 — 하위 에이전트도 3시간 배치라 불필요) |
| WEATHER AGENT | `server/agents/weatherAgent.js` | claude-haiku-4-5 | 3시간 폴링 | Open-Meteo로 13개 해역 날씨 수집 → 이모지·심각도 마커 + 악천후 보고. 항상 보고 |
| COMMODITY ANALYST | `server/agents/commodityAnalyst.js` | claude-haiku-4-5 | 3시간 폴링 | Perplexity로 원자재·운임 가격 검색 → 구조화 data_points + 한국어 시황 |
| FLOW REPORTER | `server/agents/flowReporter.js` | claude-haiku-4-5 | 3시간 폴링 | `traffic_snapshots` 이력에서 항만 원자재 유입 '강도'(입항 추정 톤수) 24h vs 직전 24h 추세 산출 → Claude 서술. 이력 없으면 자동 skip |
| INVESTMENT ANALYST | `server/agents/investmentAnalyst.js` | claude-haiku-4-5 | 3시간 폴링 | **X CAPITAL** — `xcapData.buildAllDesks`(항만 혼잡·원자재 유입·운임·체류·해수부 공식 통계)로 3 데스크 정량 신호 집계 + 최근 시황 보고 종합 → 페르소나별 투자 시그널(LONG/SHORT/HOLD)·thesis·**drivers(데이터→판단 근거 2~4개)**·종목. severity INFO 고정. 보고 1행에 `raw_data.desks=[3]`(정량+서술 병합) → X Capital 공간이 카드로 렌더. maxTokens 4500(drivers로 출력↑, 잘림 방지 이슈 #15) |
| CARGO ESTIMATOR | `src/agents/cargoEstimator.js` | claude-haiku-4-5 (기본, `CARGO_MODEL` 환경변수로 오버라이드) | 선박 클릭 | 선박 종류별 전용 프롬프트, vessel_type 변경 시 자동 재실행. 응답 ~24s(Sonnet)→~13s(Haiku) |

> **KOBC_SCRAPER**(에이전트 아님, `server/agents/kobcScraper.js`, 12시간 폴링): KOBC gridList.do를 `sDay/eDay`로 호출(1년≈246행 백필)해 HTML `<tbody>` 파싱 → `freight_history` upsert(건화물 KDCI·CAPE·PANAMAX·SUPRAMAX·HANDY, 신조선가). JSON·HTML 둘 다 파싱, 실패해도 서버 무중단(데모 모드 폴백).

### 에이전트 시작 지연 (server/index.js)
서버 시작 3초 후 500ms 간격 stagger:
- 3000ms: CHOKEPOINT WATCHER
- 3500ms: PORT ANALYST
- 4000ms: GEOPOLITICAL LINKER
- 5000ms: BASELINES WRITER
- 5500ms: WEATHER AGENT
- 6000ms: COMMODITY ANALYST
- 6500ms: FLOW REPORTER (내부적으로 시작 +20s 후 1회 실행)
- 7000ms: KOBC SCRAPER (운임·선가 → freight_history)
- 7500ms: TANKER SCRAPER (BDTI 더티탱커 → freight_history)
- 8000ms: KOR PORT STATS (해양수산부 월별 공식 통계 → kor_port_monthly)
- 8500ms: GICOMS STATS (연안 AIS 해역 밀집도 → sea_density_daily, 일별)
- 9000ms: MARKET SCRAPER (원자재·광물 상장 가격 선물/ETF/주식 → freight_history category='market', 12h)
- 9500ms: REGION NEWS COLLECTOR (37개 항만·초크포인트 최근 1주 뉴스 → region_news, 매일 1회)
- 30000ms: COUNTRY FULCRUM (지정학 L0+L1, 주1회 — WB·Perplexity 현지언어·라이브 종합 → country_fulcrum/_indicators + 공급루트)
- 40000ms: FULCRUM MONITOR (지정학 L2, 3h — fulcrum 구동 라이브 스트림 롤링 감시 → FULCRUM_MONITOR 경보)
- 20000ms: INVESTMENT ANALYST (운임 백필 + 첫 항만 집계 후 기동)
- 120000ms: MASTER AGENT (하위 사실 보고가 쌓일 시간을 두고 기동 → severity 판단)

> 새 에이전트 추가 체크리스트: ① `server/agents/<name>.js` (run/start export) → ② `server/index.js` import + setTimeout stagger → ③ 프론트 2곳 등록: `FeedTabs.jsx` TABS(해당 카테고리 탭의 agents 배열에 추가), `ReportCard.jsx` AGENT_CONFIG(아이콘·라벨). (전체 탭은 agents:null이라 자동 포함. 새 카테고리가 필요하면 TABS에 탭 객체를 추가.)

### 날씨 이모지 마커
WEATHER_AGENT는 13개 해역(초크포인트 7 + 태풍다발 해역 6)의 Open-Meteo 현재 날씨를 WMO 코드→이모지, 돌풍(m/s)→심각도(INFO/WARNING/CRITICAL)로 변환해 `raw_data.points`에 담아 보고. 폭풍급 돌풍(≥28m/s)은 🌀로 강조. 프론트는 `useAgentReports`가 최신 WEATHER_AGENT 보고의 points를 `setWeatherMarkers()`로 store에 넣고, `WeatherMarkers` 클래스(mapboxgl.Marker)가 지도에 렌더. Open-Meteo는 **API 키 불필요**.

---

## X CAPITAL — 투자 인텔리전스 공간

해양 대안데이터를 투자 관점으로 재해석하는 풀스크린 공간. StatusBar 💼 버튼으로 토글(`useStore.showXCapital`). 드라마 *Billions* 모티프의 3 페르소나가 각자 섹터 데스크를 맡아 LONG/SHORT/HOLD 시그널과 thesis를 제시.

**페르소나 ↔ 데스크 ↔ 데이터 ↔ 종목** (key는 서버 `xcapData.DESKS`와 일치):

| 페르소나(key) | 데스크 | 대표 항만 | 핵심 신호 | 운임 | 종목 |
|---|---|---|---|---|---|
| Bobby Axelrod(`axelrod`) | 컨테이너·해운 | busan·la_lb·rotterdam | 혼잡지수·컨테이너 입항(TEU) | KCCI | HMM·팬오션·대한해운 |
| Taylor Mason(`taylor`) | 건화물·철강 | gwangyang·pohang·dangjin | 벌크 입항(DWT)·공식 철광석/유연탄 처리량 | KDCI | POSCO홀딩스·현대제철 |
| Mike Wagner(`wagner`) | 에너지·정유 | ulsan·yeosu·gwangyang·singapore·rotterdam | 탱커 입항·원유 유입(DWT)·공식 원유/석유정제품 처리량 | BDTI(더티탱커) | S-Oil·GS·SK이노베이션 |

> **데스크 항구 재배치(2026-06)**: Taylor·Wagner는 원래 중국 본토 항(상하이·칭다오·닝보)을 포함했으나 **무료 aisstream(지상 수신기) 커버리지가 0**이라(중국은 AIS 미공유, 한국 남해안도 수신기 공백) 국내 철강·정유 대표항으로 교체. 단 국내 산업항도 AIS는 희소 → **해양수산부 월별 공식 통계(korPortStats→kor_port_monthly)로 보완**한다. Wagner 운임은 케이프(벌크)→BDTI(더티탱커)로 교정(정유 데스크엔 탱커 운임이 맞음). portAnalyst PORTS에 ulsan·yeosu·pohang·dangjin 4개 국내항 추가(34개).

**데이터 흐름**:
```
KOBC_SCRAPER(12h) → freight_history
baselinesWriter(60분) → trafficAggregator(항만 혼잡·입항·원자재 유입) + baselines(혼잡 시계열) + dwellTracker(체류시간 → dwell_events)
        ↓ xcapData.buildAllDesks()/buildDeskSeries()/dwellSignals()
INVESTMENT_ANALYST(3시간, Haiku) → agent_reports.raw_data.desks=[정량+서술 3, dwell 포함]
        ↓ Realtime + /api/xcap/desks·/api/xcap/desk-series
XCapitalSpace.jsx → 3 페르소나 카드(혼잡·유입·체류·운임 칩 + 자세히) + 다지표 시계열 차트(혼잡·입항·유입·체류·운임)
        + DeskDetailsModal(항구·운임지수 설명 + 실수치 시계열 표)
```
> 차트는 데스크 **전 항구를 합산**(buildDeskSeries)해 대표항 1곳만 쓰던 과거 버그(Taylor·Wagner 혼잡 라인 공백)를 해결. 입항=척수/유입=톤수·TEU 둘 다 토글, 지수(시작=100)/원본값 토글로 스케일 차이를 흡수.

**체류시간(dwell) 신호**: `dwellSignals`가 `dwell_events`에서 항만군의 `avg_dwell_hours`·`turnover_per_day`(회전)·`trend_pct`·`pressure`(수요압력: 0.5·체류/24h·100 + 0.5·혼잡지수, 100=중립) 산출. 체류↑+혼잡↑=선석 포화→운임 강세 신호로 INVESTMENT_ANALYST 프롬프트에 투입. 마감 체류 <10건이면 demo·pressure=null.

**해양수산부 공식 통계(월) 병합**: `korPortStats`가 `kor_port_monthly`에 적재한 **항만별 입항 척수(per-port)**·**전국 품목 처리량(철광석·유연탄·원유·석유정제품)**을 `korStatsForDesk`(카드 🇰🇷칩)·`buildDeskSeries`(차트 월 계단선 `korVessel`·`korCargo`)가 소비. 공식 통계는 2개월가량 지연 발행 → **캐리포워드**(최근 발행월 값을 이후 일자에 유지)로 차트에 표시. 일별 AIS 라인 + **월 계단 점선(청록 입항·분홍 화물)** 병합(`SERIES_META.step/official`). AIS가 0인 국내항도 공식 수치로 실데이터 확보. `kor_port_monthly`/`DATA_GO_KR_KEY` 없으면 demo.

**GICOMS 해역 통항 밀집도(일별, 준실시간) 병합**: `gicomsStats`가 `sea_density_daily`에 적재한 국내 7항(부산·인천·광양·울산·여수·포항·당진) 일별 통항량을 `seaDensityForDesk`가 데스크별로 합산 → 최신일 값·DoD/WoW·추세·항구분해를 `korStatsForDesk`(카드·자세히 모달)·`buildDeskSeries`(차트 `seaDensity` **일별 라인**, 우축)·`investmentAnalyst`(프롬프트 `kor_official.sea_density*`)가 소비. **2026-06-22 GICOMS WFS 수정 전엔 월별·수개월 지연이라 카드 스냅샷으로만 썼으나, 이제 라이브 AIS(혼잡)와 동일 일별 케이던스 → AIS 사각지대(철강 광양·포항·당진, 정유 울산·여수)의 1차 통항 신호**로 사용. 통합 추론(SYSTEM_PROMPT): ①라이브 혼잡과 동시 확인, ②사각지대 1차 근거, ③입항·처리량 선행 프록시, ④월별 vessel_calls 교차검증, ⑤과대가중 방지. `sea_density_daily`/`GICOMS_API_KEY` 없으면 demo.

**데모 모드 (중요)**: 풀 구현이지만 데이터 축적이 필요한 신호는 충분한 표본 전까지 **데모/추정으로 자동 격하하고 화면에 명시**한다. 지표별 `mode` 플래그(`xcapData`가 계산, UI `ModeBadge`로 노출):
- `live`(실시간): 운임(KOBC 백필로 즉시)·혼잡(동적 평년 `hasDynamic`)·유입(실시간 집계)
- `estimate`(기준추정): 혼잡 평년이 하드코딩 기준값일 때
- `demo`(축적 중): 혼잡↔운임 lag 상관(겹침<14일)·Δ흘수(draft_events<20표본)·체류시간(dwell_events<10건)
- 글로벌 배지: 하나라도 demo면 "🟡 데모 모드 · 데이터 축적 중". `freight_history`/`draft_events`/`dwell_events` 테이블 미생성 시 운임·상관·흘수·체류가 모두 demo.

**lag 상관**: `xcapData.lagCorrelation`이 일별 혼잡 시계열과 운임 시계열을 0~14일 시차로 Pearson 상관 → 최대 상관 lag/r. 겹침<14일이면 demo.

> ※ X Capital은 거친 추정 기반 **실험적** 지표이며 투자 자문이 아니다. 페르소나는 *Billions* 모티프 창작 캐릭터.

---

## 지정학 Fulcrum — 국가별 제약 인텔리전스 (Civ 컨셉)

Marko Papic *Geopolitical Alpha*의 **제약(constraints) 프레임워크**: 4대 제약(정치·정치경제 / 거시·시장 / 지정학 / 헌법·법률)을 넷 어세스먼트로 상계해 **가장 구속력 있는 제약 = fulcrum**을 찾고, 그것을 움직이는 데이터 스트림을 추적. StatusBar **🌐 지정학 토글**(`showCountryLayer`) → 국가 포인트(Civ 리더) 클릭 → `CountryFulcrumPanel`.

**데이터 모델 — 원자↔합성 분리(2·3차 가공 대비)**: 원자(`country_indicators`·`country_supply_routes`·`freight_history` category='market'·기존 라이브)는 정규화·재집계 가능, 합성(`country_fulcrum`)은 표현용. 점수화 금지 — **사실 나열 + 출처 배지 + as_of**.

**에이전트 전략 (L0→L1→L2)**:
- **L0 수집**: **거시지표는 최신성 우선 멀티소스 `data/sources/resolveIndicators.js`** — `oecd.js`(회원국 월별 CPI, 최신) → `imf.js`(IMF DataMapper, 12국 2026 추정: GDP성장·물가·실업·경상수지·GDP) → `worldBank.js`(폴백+구조지표: 에너지의존·제조업비중·거버넌스WGI). metric별 **연도 최신 채택, 동률 시 OECD>IMF>WB**. (WB 2024가 오래된 문제 해결 — 패널은 source 배지+as_of로 신선도 노출.) + `marketScraper.js`(Yahoo 선물/ETF/주식 → freight_history market)·`supplyRoutes.js`(searoute 해상 항로 + 초크포인트 교차 → country_supply_routes). (UN Comtrade/EIA 키 있으면 % 라이브, 없으면 `countryData.supplyChains` 큐레이션 % 폴백.)
- **L1 합성**: `countryFulcrumAgent.js`(주1회·Sonnet) — WB + **Perplexity 현지언어(최근 7~30일 시사)** + 라이브 종합 → 4제약 사실목록 + fulcrum·방향 → `country_fulcrum` + `country_indicators` 적재 + `buildRoutes`.
- **L2 모니터**: `fulcrumMonitor.js`(3h·룰) — fulcrum 구동 라이브 스트림(초크포인트 통항·원유선물·운임)을 **롤링(7d/z, baselineUtils 재사용)**으로 감시 → `FULCRUM_MONITOR` 경보 + `fulcrum_direction` 갱신. (MASTER·X CAPITAL 프롬프트 연동은 후속.)

**에너지 프로파일** (`data/sources/energyProfile.js`, domain='energy' 원자): 자립도(WB `EG.IMP.CONS.ZS`→100−)·1차에너지 구조(**OWID** owid-energy-data.csv 2.56MB)·발전 믹스%+**발전소 설비용량 GW**(**Ember** yearly long CSV 48.9MB, 2024/25, 배치당 1회 캐시·ISO3 스트림 필터)·전기요금(Perplexity 추정). `countryFulcrumAgent`가 `getCountryEnergy()`로 원자 적재 + Claude에 에너지 안보 요약 전달. 패널 **⚡ 에너지 탭**이 `/api/country-fulcrum` indicators(domain='energy')로 게이지·도넛·GW 막대 렌더(출처 배지+as_of). API 변경 불필요.

**프론트**: `src/data/countryData.js`(**22개국**(G20 전체 + 이란·이집트·싱가포르 초크포인트 요충) 큐레이션: 리더·구조제약·공급망·수출항 좌표 + 서버 CJS 미러 `server/data/countryData.js`, 코드젠 `scripts/generate_country_data.cjs`) · `CountryMarker.jsx`(국가 GL 레이어) · `CountryFulcrumPanel.jsx`(탭: Fulcrum 종합/4제약/공급루트) · `SupplyRouteLayer.jsx`(품목 클릭 → 지도 항로+%·초크포인트 위험포인트). API: `/api/country-fulcrum`·`/api/supply-routes`(60s 캐시).

> ※ 정성 사실은 Perplexity 현지보도 출처라 추정치 — 출처 배지로 신뢰도 노출. 공급 루트는 searoute 근사 항로(시각화용). 22개국: G20(한·중·일·미·독·영·프·이탈리아·캐나다·멕시코·브라질·인도·인니·튀르키예·아르헨티나·남아공·러시아·사우디·호주) + 이란·이집트·싱가포르(초크포인트 요충).

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

상단 StatusBar의 📊 통계 버튼으로 토글 (`useStore.showStatsDashboard` / `toggleStatsDashboard`). Recharts 기반 모달, 10개 섹션:

1. **KPI 카드 4개** — 추적 선박 수 / CRITICAL 경보 수 / 최고 혼잡 항만 / 위험 초크포인트
2. **선종 분포** — 도넛 차트 (MapFilter와 동일 색상)
3. **기국 Top 10** — 가로 막대 (국기 이모지)
4. **속력 분포** — 히스토그램 (정박·저속·항행·쾌속·고속)
5. **항행 상태 분포** — 도넛 차트 (`nav_status` 기반)
6. **초크포인트 통과량 vs 기준값** — 심각도별 색상 그룹 막대
7. **항만 혼잡도 Top 10** — 대기 선박 수 가로 막대
8. **평년 대비 편차 보드** — 항만/초크포인트 토글, 전 지역을 평년 대비 편차(%)로 발산형 막대 정렬(빨강=악화·파랑=여유, ±150% 클램프·hover로 실값/σ). `/api/comparison-board` (각 지역 최신 baselines 스냅샷 + resolveBaselineStats)
9. **에이전트 경보 타임라인** — 24시간 스택 막대 (CRITICAL/WARNING/INFO)
10. **목적지 Top 15 + 선종 드릴다운 / 목적지 국가 Top 10** — destination을 `normalizeDestination`으로 정규화해 파편화(NLRTM/NL RTM/ROTTERDAM→로테르담) 통합, 막대 클릭 시 선종 드릴다운

데이터 출처: 현재 선박은 store, 초크포인트·경보는 `agent_reports` Supabase 조회, 편차 보드는 `/api/comparison-board`.

> PORT 평년 기준값은 2026-06 baselines 실측 중앙값으로 재보정 완료(`portAnalyst.js` HARDCODED_BASELINE: 부산 250·로테르담 880·앤트워프 410 등). 과거 값(부산 12·로테르담 35)은 집계 방식(반경 내 ≤2kn 선박 수, 수백 척)보다 10~25배 낮아 편차가 +1000%로 과장됐으나, 지금은 대부분 ±20% 이내로 정상화. 미측정 항만(커버리지 공백)은 규모 기반 추정치이며 ≤2kn 선박이 거의 안 잡혀 편차 보드엔 보통 미노출.

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
DATA_GO_KR_KEY=...             ← 해양수산부 공공데이터(data.go.kr) 항만 입출항·화물 통계
GICOMS_API_KEY=...             ← GICOMS 연안 AIS 해역 밀집도 (등록 도메인 seabird.onrender.com)
UN_COMTRADE_KEY=...            ← (선택) UN Comtrade 무료 키 — 공급원별 수입 의존 % 라이브. 없으면 countryData 큐레이션 % 폴백
EIA_API_KEY=...                ← (선택) EIA 무료 키 — 에너지 수입 세분. 없으면 skip
PORT=3001

# ── 보안/어뷰징 방어 (프로덕션 권장 — server/index.js가 소비) ──
ALLOWED_ORIGINS=https://seabird-tau.vercel.app  ← CORS 허용 오리진(콤마 구분). 미설정 시 전체 허용(로컬)
RATE_LIMIT_API=120             ← 전역 /api IP당 분당 요청(기본 120)
RATE_LIMIT_PAID=10             ← Claude/Perplexity 유료 엔드포인트 IP당 합산 분당 요청(기본 10)
MAX_RELAY_CLIENTS=300          ← relay WS 전체 동시 연결 상한(egress 방어 핵심)
MAX_RELAY_PER_IP=30            ← relay WS IP당 동시 연결 상한 — **X-Forwarded-For로 실 클라이언트 IP가 구분될 때만 적용**(프록시 뒤 XFF 없으면 미적용 → 정상 사용자 합산 차단 방지). ⚠️ 과거 '6 + 무조건 적용'은 Render 프록시 IP 합산·멀티탭·재연결로 선박이 안 보이던 회귀의 원인이었음
RELAY_FLUSH_INTERVAL_MS=3000   ← relay 변경분 스냅샷 전송 주기(ms, 기본 3000). 낮을수록 선박 정보가 빠르게 보이나 egress↑. egress가 다시 튀면 10000으로 상향
```
> `DATA_GO_KR_KEY`·`GICOMS_API_KEY`는 Render에도 동일 설정 필요(render.yaml `sync:false`로 선언). GICOMS는 발급 시 등록한 도메인(seabird.onrender.com)을 쿼리 `domain` 파라미터로 넘기므로 로컬에서도 동작.
> **보안(공개 런칭 전 필독): `SECURITY.md`** — CORS allowlist·rate limit·WS 연결 상한은 코드에 반영됨(위 env로 제어). Supabase RLS 검증·Mapbox 도메인 제한·API 결제 경보·데이터 약관은 대시보드 작업이라 `SECURITY.md` 체크리스트 참조. `ALLOWED_ORIGINS`는 프로덕션에서 반드시 채울 것(비우면 전체 허용).

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
| `baselines` | 항만/초크포인트 **스칼라** 스냅샷 (waiting_ships·daily_throughput, 시계열 누적) |
| `traffic_snapshots` | 항만/초크포인트 **분해** 스냅샷 (입출항·선종·기국·목적지·원자재 유입 추정, 60분, JSONB) — FLOW REPORTER 소스 |
| `freight_history` | 운임·선가 지수 시계열 (KOBC 스크래핑, `(index_code, obs_date)` 유니크) — X CAPITAL 운임 소스 |
| `draft_events` | 선박 입항/출항 흘수 변화(Δdraft) — X CAPITAL 화물량 추정용. **현재 미적재(빈 테이블) → 흘수 신호는 데모 모드.** 라이브 Δdraft 기록기는 후속 작업(AIS 적재 경로에 추가 예정) |
| `port_presence` | 항만 체류 추적 open ledger (mmsi×port, first/last_seen·scans). dwellTracker가 매시 upsert(`port_presence_touch` RPC), 2.5h 미관측 시 dwell_events로 마감 후 삭제. 내부 작업 상태(anon 미노출) |
| `dwell_events` | 마감된 항만 체류 1건(입항→출항, dwell_hours). X CAPITAL 회전속도·수요압력 신호 소스(dwellSignals·desk-series). 180일 TTL. 미생성 시 체류 신호는 데모 모드 |
| `kor_port_monthly` | 해양수산부 월별 공식 통계(korPortStats). category=vessel(항만별 입항 척수)·cargo(전국 품목, port_id='KR'). X CAPITAL 국내항 보완(korStats·korVessel/korCargo). 미생성 시 demo. ※ category='sea_density'는 더 이상 적재 안 함(→ sea_density_daily로 이전) |
| `country_indicators` | **지정학 Fulcrum 원자 지표**(1행=1지표, 재집계용). World Bank 등 공식 지표 → countryFulcrumAgent 적재. (country_code, domain, metric_key, value, source, as_of) |
| `country_fulcrum` | **지정학 Fulcrum 합성**(국가별 4제약 사실목록 + fulcrum_constraint + 방향). countryFulcrumAgent(L1) 적재, fulcrumMonitor(L2)가 방향 갱신. `/api/country-fulcrum` |
| `country_supply_routes` | **에너지·광물 공급 루트**(수입국×품목×공급원×%, searoute LineString, 지나는 초크포인트). supplyRoutes 엔진 적재. `/api/supply-routes`·SupplyRouteLayer |
| `region_news` | 항만·초크포인트 뉴스 **일배치 저장**(region_id PK, 최신 1주 한국어 content). regionNewsCollector(매일)가 Perplexity→Claude 번역→upsert. `/api/region-news`가 저장본 즉시 서빙(라이브 폴백). 미생성 시 라이브 폴백 |
| `sea_density_daily` | GICOMS 연안 AIS 해역 통항 밀집도 **일별**(port_id×obs_date, ais_sum). 2026-06-22 WFS 수정으로 일별·당일까지 제공 → 라이브 AIS와 동일 케이던스의 국내 산업항 1차 신호. X CAPITAL `seaDensityForDesk`(카드·DoD/WoW·추세·항구분해)·`buildDeskSeries`(차트 일별 라인). freight_history(obs_date) 패턴. 미생성 시 해역밀집 demo |

> **freight_history·draft_events 미생성 시**: `supabase_schema.sql`의 해당 CREATE TABLE 블록을 SQL Editor에서 실행해야 함. 없으면 KOBC_SCRAPER upsert가 실패(`Could not find the table`)하고 INVESTMENT_ANALYST·`/api/xcap/*`는 **데모 모드**로 동작(혼잡·유입은 정상, 운임·상관·흘수만 '축적 중'). 생성 즉시 다음 스크래퍼 런에서 운임 1년치가 백필되어 LIVE 전환.

> **port_presence·dwell_events·port_presence_touch 미생성 시**: `supabase_schema.sql`의 해당 블록(테이블 2개 + plpgsql 함수)을 SQL Editor에서 실행해야 함. 없으면 baselinesWriter가 1회 경고 후 dwell 추적을 조용히 skip(baselines·traffic은 정상)하고, 체류 신호(`dwell`·desk-series의 dwell 컬럼)는 **데모 모드**로 표시. 생성 후 baselinesWriter가 매시 present 선박을 적재하며, 입항 후 2.5h 이상 머문 선박이 출항하면 첫 dwell_events가 생긴다(수 시간 축적 필요).

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

> `traffic_snapshots` 테이블도 초기 스키마에 없음 — `supabase_schema.sql`의 해당 CREATE TABLE 블록을 SQL Editor에서 실행해야 함. **없으면 baselinesWriter의 traffic 적재가 실패(1회 경고 후 조용히 skip)하고, FLOW REPORTER는 `no_data`로 skip**한다(baselines·지도·port-stats는 정상). 직접 만들려면:
> ```sql
> CREATE TABLE IF NOT EXISTS traffic_snapshots (
>   id BIGSERIAL PRIMARY KEY, location_id VARCHAR(30) NOT NULL, location_type VARCHAR(12) NOT NULL,
>   total_ships INT NOT NULL DEFAULT 0, inbound INT, outbound INT, passing INT,
>   vessel_type_dist JSONB, flag_dist JSONB, dest_country_dist JSONB,
>   inbound_by_type JSONB, commodity_inflow JSONB, snapshot_at TIMESTAMP NOT NULL DEFAULT NOW());
> CREATE INDEX IF NOT EXISTS idx_traffic_loc ON traffic_snapshots (location_id, snapshot_at DESC);
> CREATE INDEX IF NOT EXISTS idx_traffic_at ON traffic_snapshots (snapshot_at DESC);
> ```
> **원자재 유입 추정(commodity_inflow)**: trafficAggregator가 입항(inbound) 선박을 선종별로 분류해 `입항 선박 × 클래스 평균 DWT(TYPICAL_DWT) × 적재율 0.85`로 추정 — 탱커=원유·석유제품(est_liquid_dwt), 벌크=건화물(est_dry_bulk_dwt), 컨테이너=TEU(est_container_teu), LNG(est_lng_dwt). 절대값은 거친 추정이라 **추세(FLOW REPORTER의 DoD 증감)**에 의미를 둔다. `/api/port-stats`가 라이브로도 반환 → 선박 동향 탭에 즉시 표시.

---

## 알려진 이슈 / 주의사항

1. **mapbox-gl 번들 크기**: 프로덕션 빌드 시 ~2.3MB 경고. 해커톤 범위에서는 무시.
2. **heading=511**: AIS 미수신값. `aisParser.js`에서 `null`로 처리.
3. **에이전트 초기 CRITICAL 보고**: 서버 시작 직후 AIS 데이터가 적어 초크포인트 통과량이 0으로 집계됨. 30분~1시간 후 안정화.
4. **MASTER_AGENT 역할 변경(severity 전담)**: 과거의 '긴급 시 타 에이전트 재실행' 로직은 제거됨(하위 에이전트도 3시간 배치). 지금은 최근 3.5시간 하위 사실 보고를 종합해 severity만 판단한다. 시작 시 +120초 후 첫 기동.
5. **Render 콜드 스타트**: 무료 티어는 15분 비활성 후 슬립. UptimeRobot으로 30분마다 헬스체크 핑 설정 권장.
6. **ships 테이블 미생성 시 선박 미표시**: `supabase_schema.sql` 전체를 Supabase SQL Editor에서 실행해야 함. `agent_reports`만 있고 `ships`가 없으면 지도에 선박이 나타나지 않음.
7. **호르무즈 등 일부 해역 선박 공백**: aisstream.io 무료 티어는 지상 수신기 기반이라 페르시아만·홍해 등 일부 해역의 커버리지가 제한됨. 제재 회피 AIS 소등 선박은 수신 불가.
8. **PortMarker는 GL 레이어 방식**: HTML 마커(mapboxgl.Marker)가 아닌 GeoJSON circle+symbol 레이어로 구현. 줌/팬 시 지도와 정확히 동기화됨. 초크포인트는 여전히 HTML 마커.
9. **ship_positions anon RLS 차단**: RLS 정책이 정상(PERMISSIVE SELECT public)인데도 anon 키로는 0행만 반환됨(원인 미상). 그래서 항적은 브라우저 직접 조회가 아니라 `GET /api/ship-track`(서버 service_role)로 읽는다.
10. **HTML 마커 애니메이션 주의**: mapboxgl.Marker 엘리먼트의 `transform`은 Mapbox가 위치 고정에 사용하므로, CSS 애니메이션에서 `transform`(rotate/translate 등)을 마커 엘리먼트에 직접 걸면 줌/팬 시 위치 이탈. 애니메이션은 내부 자식 엘리먼트에 적용할 것(WeatherMarker의 `.weather-emoji` 패턴). `box-shadow`만 쓰는 초크포인트 마커는 무관.
11. **AIS 유휴 워치독**: aisstream WebSocket이 half-open(좀비)되면 `close`가 안 떠 재연결이 안 됨 → 서버가 조용히 수신 중단. `index.js`가 60초 무수신 시 소켓을 강제 종료해 재연결한다.
12. **Render 배포 시 Supabase 키**: `seabird-server`의 `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL`(render.yaml에서 `sync:false`)을 Render 대시보드에 **로컬 `server/.env`와 동일하게** 설정해야 함. 키가 잘못되면 서버의 모든 Supabase 작업이 `{"error":"Invalid API key"}`로 실패(항적·DB 쓰기 전부 불가)하나, AIS relay와 프론트 anon 읽기는 동작해 증상이 가려짐.
13. **초크포인트 "통과 선박"은 통항량이 아니라 스냅샷**: `/api/chokepoint-stats`·`chokepointWatcher`의 카운트는 "해당 bbox 안에 최근 1h 내 위치가 잡힌 선박 수"(순간 스냅샷)이지, 1시간 동안 통과한 누적 통항량이 아니다. 그래서 bbox 크기·AIS 커버리지에 따라 절대값이 크게 다르다(말라카 큰 박스 = 수백, 호르무즈 무수신 ≈ 0).
14. **평년(baseline) 산출 정책 — `agents/baselineUtils.js` `resolveBaseline(db, locationId, metric, hardcoded)`**: 항만·초크포인트 공용 헬퍼. `baselines`의 해당 metric 이력에서 **0 스냅샷(수집 공백)을 제외**한 실측 표본이 **48개 이상 + 24h 이상 분포**할 때만 그 평균을 동적 평년으로 쓰고, 그 전엔 하드코딩 기준값(초크포인트: 수에즈 58·말라카 247 등 / 항만: 부산 250·로테르담 880 등 — 2026-06 실측 중앙값 재보정)을 쓴다. **4곳이 동일 정책 공유** — `/api/chokepoint-stats`·`chokepointWatcher`(metric=`daily_throughput`), `/api/port-stats`·`portAnalyst`(metric=`waiting_ships`). 하드코딩 기준값 단일 소스는 `portAnalyst.js`(HARDCODED_BASELINE)·`chokepointWatcher.js`이며, `baselinesWriter.js`의 중복 맵은 제거됨(실측 스냅샷만 기록). (과거: 동적 `avg_90d`가 마이그레이션 이전 0들로 오염돼 평년이 0.1~16.5로 나오고, 항만은 패널=하드코딩/에이전트=오염 avg_90d로 따로 놀던 버그를 이 정책으로 통일·차단. `baselinesWriter`의 `avg_90d` 컬럼은 이제 소비되지 않고 이력 기록용.) **2026-06-23: `resolveBaselineStats`가 roll(ma7/ma30/wow7/mom30/z)·smoothedCurrent도 반환 — 보고는 순간값이 아닌 7일 평균 기준으로 전환(아래 #23).**
15. **에이전트 Claude JSON 견고성 — `agents/claudeClient.js`**: `callClaude`가 응답 JSON을 추출할 때 객체(`{}`)·배열(`[]`) 모두 지원, 코드펜스·후행콤마 제거, 파싱 실패 시 누락 콤마(`}{`→`},{`) 보정, 그래도 실패하면 **1회 재시도**(429/5xx·네트워크·파싱 실패). 또한 `max_tokens`가 작으면 큰 마크다운(예: PORT_ANALYST 30개 항만 표, MASTER 5섹션)이 잘려 "Unterminated JSON"이 나므로 충분히 잡음 — portAnalyst 4000, chokepointWatcher 6000, masterAgent 3000. 과거엔 배열 미지원+토큰 부족으로 PORT/CHOKEPOINT 보고가 주기적으로 유실됐다.
16. **보고 카드 중복 key 방지 — `useStore.addReport`**: 초기 로드(50건) + Realtime 구독 + React StrictMode 이중 마운트로 같은 `agent_reports` 행이 중복 추가돼 React "duplicate key" 경고가 대량 발생했음 → `addReport`가 동일 `id` 존재 시 무시. (브라우저 콘솔 점검은 헤드리스 Chrome+CDP로 가능: 단 WebGL이 없으면 Mapbox가 죽으므로 `--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`로 SW 렌더 활성화 필요.)
17. **WebGL 미지원 폴백 — `MapView.jsx`**: 에러 바운더리가 없어, WebGL 비활성 브라우저에서 Mapbox 초기화 실패 시 앱 전체가 흰 화면이 됐음 → `new mapboxgl.Map`을 try/catch로 감싸 실패 시 안내 오버레이 표시(`mapError`). `map.on('error')`로 비치명적 타일 에러 콘솔 스팸도 억제.
18. **지도 선박 색상(선종) 비어 보임 — `useAISStream`**: 라이브 relay PositionReport는 `vessel_type='Other'`로만 들어오고, 과거엔 localStorage 캐시가 신선하면 Supabase 보강을 통째로 생략해 지도가 거의 회색이었음. → `enrichFromSupabase`를 **로드 시 항상 + 3분 주기**로 실행해 서버가 누적한 선종/국적을 지도에 병합(`updated_at` 최신순으로 송신 중 선박과 매칭률↑). Class B 메시지(19/24)도 처리. 효과: 색칠 비율 ~0% → ~55%(무료 티어 선종 수신율 상한 내 최대치). DB 전체 선종 보유율 자체는 ~37%(정적 메시지 희소).

20. **Supabase 무료 티어 Disk IO 예산 → 통계 쿼리 경량화**: 무료/소형 티어는 **Disk IO Budget**(버스트 IOPS)이 있어, 소진되면 baseline IOPS로 강등돼 빈 테이블 쿼리도 수 분 걸리거나 타임아웃(HTTP 000)난다. #19 폭증으로 예산이 바닥난 뒤, 부하 0(=Render Suspend)로 ~8분이면 임계선은 넘지만 무거운 집계 쿼리 몇 개로 즉시 재고갈됨 → 완전 충전엔 더 긴 무부하 시간 필요. **부하를 줄이는 레버는 select 컬럼 수가 아니라(힙 전체를 읽으므로 IO 무관, egress만 절약) ① 빈도 ② 동시성 ③ 캐시**다. 적용: `baselinesWriter` 30→60분, **`/api/comparison-board`를 지역별 30쿼리(resolveBaselineStats)→ 단일 쿼리(해당 metric 최신순 limit 5000 한 번에 읽어 JS 그룹·집계)로 전환** (이 30쿼리 패턴이 stuck 적체의 주범이었음), **port-stats·chokepoint-stats·comparison-board·baseline-history·change-windows에 60초 인메모리 캐시(`statsCache`)** — 패널 여닫을 때마다 ships 재스캔하던 부담 제거. 회복은 Render Suspend + 조용히 대기(무부하 시 IO 예산 자동 충전)뿐이며, 급하면 컴퓨트 사이즈 변경(Small 등)으로 즉시 리셋(=새 하드웨어 재프로비저닝, 메모리·IO 동시 해소).

19. **`ship_positions` 폭증 → Supabase 리소스 소진 (2026-06-13 수정)**: `index.js`가 글로벌 AIS의 **모든** PositionReport를 그대로 `ship_positions`에 INSERT해, 6h TTL만으로도 **~1,130만 행**이 쌓여 무료 티어 디스크 I/O·autovacuum을 소진(대시보드 "exhausting multiple resources" 경고). 수정: ① **같은 mmsi는 60초당 1건만 저장**(`lastPositionStoredAt` throttle) → 쓰기량 10~30×↓, ② TTL **6h→2h**(`POSITIONS_TTL_MS`), ③ 정리 주기 1h→20분(작은 배치). 추가로 TTL DELETE가 풀스캔하지 않도록 `idx_ship_positions_recorded_at`(recorded_at 단독) 인덱스 필요. **기존 백로그는 `TRUNCATE ship_positions;`(SQL Editor)로 즉시 비워야 함** — 항적은 ephemeral이라 수 분 내 재축적. (ship-track 쿼리는 mmsi당 ~120점/2h로 충분.)

21. **Render 대역폭(egress) 폭증 → relay 배치·압축 (2026-06-14 수정)**: `index.js`가 aisstream **글로벌 firehose의 모든 메시지를 raw 그대로 `broadcast`**해, 연결된 브라우저 1개당 월 수백 GB가 나갔다(Render Pro 25GB/월 70% 경고). aisstream→서버(수신)는 ingress라 무과금이고 **서버→브라우저 relay만 과금**이라 relay가 유일한 레버. 수정: ① **`perMessageDeflate: true`**(WSS) — AIS JSON 압축률 높음, ② **메시지마다 중계 폐기 → 변경 선박만 N초마다 compact 배치 스냅샷**(`{type:'snapshot', ships:[...]}`, `compactShip`로 의미 있는 필드만, 같은 mmsi 다중 위치보고 dedup. 주기는 `RELAY_FLUSH_INTERVAL_MS` env, 기본 3000ms — 과거 10초는 선박 정보가 최대 10초 늦게 보이던 체감 지연의 원인이라 3초로 조정), `relayDirty` Set으로 변경분 추적(Supabase용 `dirtyMmsi`와 별도), ③ 새 탭 접속 시 전체 스냅샷 1회(`full:true`), ④ **보는 클라이언트 0이면 전송 skip**. 프론트(`useAISStream.js` onmessage)도 raw aisstream 파서 → snapshot 파서로 교체(없는 필드는 기존값 유지). 효과: raw 중계 대비 egress 90%+↓. ⑤ **방치 탭 자동 종료**(`useAISStream.js`): 백그라운드 탭(`document.hidden`)은 즉시, 포그라운드라도 10분 무활동(`IDLE_DISCONNECT_MS`)이면 relay WS를 끊고(`intentionalCloseRef`로 5초 자동 재연결 억제), 탭 복귀·사용자 활동(mousemove/key/touch/scroll) 시 재연결한다(서버가 접속 시 full 스냅샷 재전송 → 즉시 복구). 숨김 탭은 Supabase enrich도 skip. 상태표시줄은 `PAUSED`='일시중지'로 표시. 데모 끝나고 열어둔 탭이 계속 빨아들이던 egress 차단.

23. **롤링(7일/30일) 보고 — 단일 시점 과대반응 차단 (2026-06-23)**: PORT·CHOKEPOINT·MASTER·X CAPITAL이 **순간 1시점 스냅샷 vs 평년**으로 change_pct를 내, 라이브 ships가 잠깐 비거나(예: now=0) 튀면 −100%/+수백% 거짓 경보가 났다. `baselineUtils.resolveBaselineStats`가 이제 `roll{ma7,ma30,prev7,prev30,wow7,mom30,z}`·`smoothedCurrent(=ma7)`·`smoothedChangePct`를 반환(`baselines` 이력에서 0 제외 표본의 7일/30일 이동평균). **change_pct·severity는 순간값이 아니라 7일 평균 기준**, z(|z|≥1.5만 유의)로 노이즈 게이팅, wow7/mom30로 주간·월간 추세. 적용: `portAnalyst`/`chokepointWatcher`(data_points.current=7일평균, raw_data에 wow/mom/z), `masterAgent`(프롬프트가 지속성 요구 — 단발 스파이크는 INFO), `xcapData`(congestion·sea_density 모두 7일 MA·wow·z; AIS 사각 국내항은 미관측 시 null+demo로 정직 표시 — −100% 금지). sea_density는 일변동 CoV 6~12%라 DoD는 노이즈로 강등, ma7/wow7/z가 주지표. `investmentAnalyst` 프롬프트도 "당일 등락 무시, 7일/주간·z로 판단".

22. **지도 선박이 ~1,000척에서 멈춤 → PostgREST max-rows 페이지네이션 (2026-06-22 수정)**: `ships` 테이블엔 수만 행이 있는데 `useAISStream.enrichFromSupabase`의 prefetch가 `.limit(6000)`을 줘도 **이 Supabase 프로젝트의 PostgREST `max-rows`가 1000**이라 1000행만 반환 → 지도가 ~1000척에서 정체(그 1000척이 localStorage에도 저장돼 새로고침해도 1000에서 시작). 수정: `.limit(6000)` → **`range(from, from+999)` 1000행씩 페이지네이션**(`PREFETCH_MAX=6000`, `PREFETCH_PAGE=1000`). 이후 라이브 relay가 firehose에서 받는 대로 추가 증가. (대안: Supabase 대시보드 Settings→API Max rows 상향 — 모든 쿼리 egress 영향이라 코드 페이지네이션이 안전.) ⚠️ 다른 곳에서 `.limit(>1000)`을 쓰는 쿼리도 동일하게 잘리므로 주의(서버 통계 쿼리는 limit 5000을 쓰지만 실제 행이 적어 무영향).

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
| 6+ | 비교 수치 시스템 (점=평년 게이지 / 추이=24h 스파크라인·z-score / 지역=편차 보드) | ✅ 완료 |
| 7 | 버그픽스 + 데모 시나리오 준비 | 🔲 |
