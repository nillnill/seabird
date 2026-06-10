# Seabird — AI eyes on every ocean

해양 실시간 인텔리전스 플랫폼. AIS 선박 데이터와 5개 AI 에이전트가 결합된 해커톤 프로젝트.

> **CLAUDE.md 관리 원칙**: 파일 추가·삭제·기능 변경이 있을 때마다 이 문서를 업데이트한다.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Vite 6 + React 18 + Tailwind CSS v3 |
| 상태관리 | Zustand 5 |
| 지도 | Mapbox GL JS v3 (dark-v11 스타일) |
| AI | Claude API `claude-sonnet-4-6` (브라우저에서 직접 호출) |
| DB / Realtime | Supabase (PostgreSQL + Realtime) |
| 백엔드 프록시 | Node.js + Express + ws (포트 3001) |
| AIS 데이터 | aisstream.io WebSocket |

---

## 디렉토리 구조

```
seabird/
├── CLAUDE.md                  ← 이 파일 (작업마다 업데이트)
├── MIC_PRD_v1.md              ← 원본 PRD (수정 완료)
├── supabase_schema.sql        ← Supabase SQL 에디터에서 실행
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json               ← 프론트엔드 의존성
├── .env.local                 ← 프론트엔드 환경변수 (git 제외)
├── .env.local.example
│
├── server/
│   ├── index.js               ← AIS 프록시 + relay + /api/news
│   ├── package.json
│   ├── .env                   ← 서버 환경변수 (git 제외)
│   └── .env.example
│
└── src/
    ├── main.jsx
    ├── App.jsx                ← 레이아웃 + 에이전트 스케줄 초기화
    ├── index.css              ← 다크 해양 테마 + chokepoint 애니메이션
    │
    ├── agents/
    │   ├── orchestrator.js    ← Commander 자연어 → 에이전트 라우팅
    │   ├── portAnalyst.js     ← 10분 폴링, 8개 항만
    │   ├── chokepointWatcher.js ← 5분 폴링, 9개 초크포인트
    │   ├── cargoEstimator.js  ← 선박 클릭 트리거
    │   ├── anomalyDetector.js ← 2분 폴링, ship_positions 기반
    │   └── geopoliticalLinker.js ← 15분 폴링, 뉴스 연동
    │
    ├── components/
    │   ├── MapView.jsx        ← Mapbox 지도 + 선박 아이콘
    │   ├── CommandFeed.jsx    ← 오른쪽 패널 전체
    │   ├── CommanderInput.jsx ← 자연어 입력창
    │   ├── ReportCard.jsx     ← 에이전트 보고 카드
    │   ├── ReportModal.jsx    ← 상세 보기 모달 (react-markdown)
    │   ├── ShipDetailPanel.jsx ← 선박 클릭 상세 + 화물 추정
    │   ├── ChokepointMarker.jsx ← Mapbox custom HTML marker
    │   ├── FeedFilter.jsx     ← 에이전트별 필터 토글
    │   └── StatusBar.jsx      ← 상단 상태 표시줄
    │
    ├── hooks/
    │   ├── useAISStream.js    ← ws://localhost:3001/relay 연결
    │   └── useAgentReports.js ← Supabase Realtime 구독
    │
    ├── store/
    │   └── useStore.js        ← Zustand 전역 상태
    │
    ├── utils/
    │   ├── claudeClient.js    ← Claude API fetch wrapper
    │   ├── supabaseClient.js  ← Supabase 클라이언트 싱글턴
    │   ├── aisParser.js       ← AIS 메시지 → GeoJSON Feature
    │   └── geoUtils.js        ← distanceNm, nmToDeg, bbox 유틸
    │
    ├── data/
    │   ├── tradePairs.js      ← 15개 교역 쌍 + 계절 인덱스
    │   └── hardcodedBaselines.js ← 초기 베이스라인 시드값
    │
    └── types/                 ← (현재 미사용, 향후 JSDoc 타입)
```

---

## 환경변수

### 프론트엔드 (`.env.local`)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_MAPBOX_TOKEN=pk.eyJ...
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_PROXY_URL=http://localhost:3001
```

### 서버 (`server/.env`)

```env
AISSTREAM_API_KEY=...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEWSAPI_KEY=...
PORT=3001
```

> **주의**: NewsAPI 키는 서버에만 있음. 브라우저에서 NewsAPI를 직접 호출하면 CORS 에러 발생.
> 반드시 프록시 `/api/news` 엔드포인트를 통해 호출.

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
npm run server    # Node.js 프록시  → http://localhost:3001

# 프로덕션 빌드
node_modules/.bin/vite build   # npx vite 사용 금지 (vite@8 설치 문제)
```

> **빌드 시 주의**: `npx vite build`는 npx가 vite@8을 새로 받아 실패한다.
> 반드시 `node_modules/.bin/vite build`를 사용할 것.

---

## Supabase 스키마

`supabase_schema.sql`을 Supabase SQL 에디터에서 전체 실행.

| 테이블 | 용도 | 특이사항 |
|--------|------|----------|
| `ships` | AIS 현재 위치 캐시 | PK: mmsi, 프록시가 30초 배치 upsert |
| `ship_positions` | AIS 위치 이력 | ANOMALY DETECTOR 전용, 2시간 TTL (서버가 1시간마다 정리) |
| `agent_reports` | 에이전트 보고 카드 | Realtime 활성화됨, anon 읽기 허용 |
| `baselines` | 항만/초크포인트 수치 스냅샷 | UNIQUE 제약 없음 (시계열로 누적) |
| `anomaly_history` | ANOMALY DETECTOR 이력 | agent_reports FK 참조 |

---

## 아키텍처 — AIS 데이터 흐름

```
aisstream.io WebSocket
    ↓ (단일 연결, server/index.js)
Node.js 프록시 (포트 3001)
    ├─ WebSocket relay → 브라우저 (ws://localhost:3001/relay)
    ├─ 30초 배치 → Supabase ships 테이블 upsert
    └─ 10초마다 → ship_positions INSERT

브라우저 (useAISStream.js)
    ← ws://localhost:3001/relay
    → GeoJSON 버퍼(500ms) → Mapbox source.setData()
```

**핵심**: 브라우저가 aisstream.io에 직접 연결하지 않는다. 반드시 프록시 relay를 통함.

---

## 5개 AI 에이전트

모두 Claude `claude-sonnet-4-6` 호출. 결과는 `agent_reports` INSERT → Realtime → 피드 카드.

| 에이전트 | 파일 | 트리거 | 주요 데이터 |
|----------|------|--------|-------------|
| PORT ANALYST | `portAnalyst.js` | 10분 폴링 | ships 테이블 (speed≤2.0 = 대기), baselines |
| CHOKEPOINT WATCHER | `chokepointWatcher.js` | 5분 폴링 | ships bbox 쿼리, baselines |
| CARGO ESTIMATOR | `cargoEstimator.js` | 선박 클릭 | selectedShip 정보 + tradePairs |
| ANOMALY DETECTOR | `anomalyDetector.js` | 2분 폴링 | ship_positions (2h 이력), anomaly_history |
| GEOPOLITICAL LINKER | `geopoliticalLinker.js` | 15분 폴링 | /api/news, agent_reports (최근 이상 보고) |

### 에이전트 시작 지연 (App.jsx)
에이전트 간 Claude API rate limit 방지를 위해 500ms 간격 스태거 시작:
- 0ms: CHOKEPOINT WATCHER
- 500ms: PORT ANALYST
- 1000ms: ANOMALY DETECTOR
- 1500ms: GEOPOLITICAL LINKER
- CARGO ESTIMATOR: 선박 클릭 시에만 실행

---

## Claude API 호출 (`utils/claudeClient.js`)

```javascript
// 올바른 헤더 형식
headers: {
  'Content-Type': 'application/json',
  'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',  // 브라우저 직접 호출 시 필요
}
// model: 'claude-sonnet-4-6'  ← 현재 프로젝트 기준 모델
```

---

## 배포

| 서비스 | 플랫폼 | 설정 파일 |
|--------|--------|-----------|
| 프론트엔드 | Vercel | `vercel.json` (Day 6에 생성 예정) |
| 프록시 서버 | Render | `render.yaml` (Day 6에 생성 예정) |

Vercel 환경변수에서 `VITE_PROXY_URL`을 Render 서버 URL로 교체.

---

## 알려진 이슈 / 주의사항

1. **mapbox-gl 번들 크기**: 프로덕션 빌드 시 ~2.3MB 경고. 해커톤 범위에서는 무시.
2. **heading=511**: AIS 미수신값. `aisParser.js`에서 `null`로 처리해 아이콘 오회전 방지.
3. **ship_positions 초기 2시간**: 시작 직후엔 AIS 이력 부족. ANOMALY DETECTOR는 LOW_SPEED + PRIOR_ANOMALY_HISTORY 점수만으로 동작하고, 2시간 후 전체 감지 활성화.
4. **Claude API 429**: 에이전트 동시 5개 이상 호출 시 rate limit 가능. 각 에이전트에 재시도 1회 후 스킵 로직 추가 예정.
5. **Render 콜드 스타트**: 무료 티어는 15분 비활성 후 슬립. UptimeRobot으로 30분마다 헬스체크 핑 설정 권장.

---

## 구현 일정 (7일)

| Day | 목표 | 상태 |
|-----|------|------|
| 1 | 프로젝트 스캐폴드 + AIS 지도 + Supabase 연결 | ✅ 완료 |
| 2 | Command Feed UI + Realtime 보고 카드 | 🔲 |
| 3 | CARGO ESTIMATOR + CHOKEPOINT WATCHER | 🔲 |
| 4 | PORT ANALYST + ANOMALY DETECTOR | 🔲 |
| 5 | GEOPOLITICAL LINKER + Commander 자연어 | 🔲 |
| 6 | 비교 수치 시스템 + Vercel/Render 배포 | 🔲 |
| 7 | 버그픽스 + 데모 시나리오 준비 | 🔲 |
