# Seabird — PRD v1.0
> *AI eyes on every ocean* | 바이브코딩 최적화 버전 | 작성일: 2026-06-10 | 해커톤 1주 일정

---

## 목차
1. [프로젝트 개요 및 문제 정의](#1-프로젝트-개요-및-문제-정의)
2. [목표 및 성공 지표](#2-목표-및-성공-지표)
3. [논-골 (명시적 제외 범위)](#3-논-골)
4. [사용자 스토리](#4-사용자-스토리)
5. [기능 요구사항 P0/P1/P2](#5-기능-요구사항)
6. [에이전트별 상세 스펙](#6-에이전트별-상세-스펙)
7. [데이터 모델 (Supabase 스키마)](#7-데이터-모델)
8. [API 연동 스펙](#8-api-연동-스펙)
9. [UI/UX 요구사항](#9-uiux-요구사항)
10. [개발 일정 및 마일스톤](#10-개발-일정-및-마일스톤)
11. [오픈 이슈 및 리스크](#11-오픈-이슈-및-리스크)

---

## 1. 프로젝트 개요 및 문제 정의

### 1.1 배경

전세계 해운 물동량은 국제 교역의 80%를 담당한다. 수에즈 봉쇄(2021), 홍해 드론 공격(2024), 파나마 가뭄으로 인한 운하 통제(2023) 등 해운 리스크 이벤트는 평균 72시간 내에 공급망 가격에 반영된다. 그러나 기존 AIS 모니터링 솔루션(MarineTraffic, VesselFinder)은 데이터 시각화에 머물며 **"지금 무슨 일이 일어나고 있는가"에 대한 자동 해석과 인사이트 생성 기능이 없다.**

### 1.2 문제 정의

| 문제 | 영향 대상 | 현재 해결 방법의 한계 |
|------|-----------|----------------------|
| 초크포인트 통과량 급감을 즉각 인지하지 못함 | 공급망 담당자 | 수동 대시보드 확인 + 뉴스 크롤링 |
| 특정 항만 혼잡도가 언제 임계치를 넘는지 예측 불가 | 물류 기획자 | 현재값만 확인, 추세 없음 |
| 선박 AIS 이상행동(dark ship 등)을 자동 탐지하는 도구가 고가 | 무역 리스크 분석가 | Windward, Pole Star 등 구독료 월 수천 달러 |
| 화물 구성 추정에 여러 데이터 소스를 수동 취합 | 트레이더, 보험사 | 엑셀 수작업 |

### 1.3 솔루션 요약

**Seabird** (*AI eyes on every ocean*)는 실시간 AIS 스트림 위에 5개의 독립 AI 에이전트를 운용하여, **"데이터 → 인사이트 → 보고"를 자동화하는 해양 인텔리전스 플랫폼**이다.

```
AIS Stream (aisstream.io)
        ↓ (단일 WebSocket 연결)
Node.js Proxy (server/proxy.js)
  ├─ Supabase ships upsert (30초 배치)
  ├─ Supabase ship_positions INSERT (이력, 2시간 TTL)
  ├─ /api/news 엔드포인트 (NewsAPI CORS 우회)
  └─ WebSocket Relay → 브라우저 (Mapbox 실시간 렌더링)
        ↓
멀티 에이전트 레이어 (5개 에이전트, 독립 폴링 — 브라우저 사이드)
  └─ Supabase 쿼리 + Claude API (claude-sonnet-4-6) → 보고 카드 생성
        ↓
Command Feed UI (우측 패널) + Mapbox 지도
```
> **연결 구조**: aisstream.io에는 프록시 서버 1개만 연결. 브라우저는 프록시의 WebSocket relay를 통해 선박 위치를 수신하여 Mapbox에 렌더링.

---

## 2. 목표 및 성공 지표

### 2.1 해커톤 목표 (1주)

| # | 목표 | 측정 방법 | 합격 기준 |
|---|------|-----------|-----------|
| G1 | 실시간 선박 10,000척+ 지도 렌더링 | FPS 측정 | 60FPS 유지 (WebGL) |
| G2 | 5개 에이전트 자동 보고 작동 | 보고 카드 생성 수 | 데모 30분 내 최소 3건 보고 자동 생성 |
| G3 | Commander 자연어 입력 → 에이전트 라우팅 | E2E 테스트 | "부산항 상황" 입력 후 5초 내 PORT ANALYST 보고 |
| G4 | 비교 수치 시스템 작동 | 보고 카드 내 현재값/평균/변화율 존재 여부 | 모든 보고 카드에 3개 수치 동시 표시 |
| G5 | Vercel + Render 배포 완료 | 외부 URL 접속 | HTTPS URL로 지도 + 피드 동시 작동 |

### 2.2 성공 지표 (데모 기준)

- **기술 지표**: WebSocket 연결 유지율 99%+, AIS 메시지 처리 지연 < 2초
- **기능 지표**: 5개 에이전트 모두 트리거 조건 도달 시 보고 카드 자동 생성
- **UX 지표**: 선박 클릭 → CARGO ESTIMATOR 결과 표시까지 < 8초

---

## 3. 논-골

| 제외 항목 | 제외 이유 |
|-----------|-----------|
| 사용자 인증/로그인 시스템 | 해커톤 범위 초과, 단일 사용자 데모 목적 |
| 히스토리 데이터 재생 기능 | AIS 이력 데이터 유료 API 필요, Day 7 이후 과제 |
| 모바일 반응형 완성도 | 지도+패널 레이아웃의 모바일 UX는 별도 설계 필요, Day 6에 기본 반응형만 |
| 선박 추적 알림(이메일/SMS/푸시) | 알림 인프라 별도 구축 필요 |
| 실시간 기상/해류 오버레이 | 별도 API(OpenWeather Marine 등) 연동 필요, P2로 분류 |
| 다국어(영어 외) 지원 | UI는 영어, AI 코멘트는 한국어로 고정 |
| 화물 가격 예측 | 외부 시장 데이터(Baltic Index 등) 연동 필요 |

---

## 4. 사용자 스토리

### 페르소나 A — 공급망 담당자 (Supply Chain Manager)
> 한국 대기업 구매팀, 원자재 수입 물류 담당

- **A1**: 오늘 수에즈 운하 통과 선박이 평소보다 줄었는지 **대시보드를 열자마자 5초 안에 확인**하고 싶다. → CHOKEPOINT WATCHER 피드 카드
- **A2**: 부산항 대기 선박이 급증할 때 **자동으로 경고를 받고** 우리 물량에 미치는 영향을 예측하고 싶다. → PORT ANALYST CRITICAL 보고
- **A3**: 특정 선박이 어떤 화물을 싣고 오는지 **클릭 한 번으로 추정 결과**를 보고 싶다. → CARGO ESTIMATOR

### 페르소나 B — 트레이드 리스크 분석가 (Trade Risk Analyst)
> 선물 트레이딩 회사, 원자재 공급 리스크 모니터링

- **B1**: AIS 신호가 비정상적으로 끊기는 선박을 **자동으로 탐지**하고 MMSI + 리스크 점수를 확인하고 싶다. → ANOMALY DETECTOR
- **B2**: 중동 관련 뉴스 발생 시 호르무즈 통과량 변화와 **자동으로 연결된 분석**을 받고 싶다. → GEOPOLITICAL LINKER
- **B3**: "MMSI 123456789 위험 여부 분석해줘"처럼 **자연어로 에이전트에 지시**하고 싶다. → Commander 입력창

### 페르소나 C — 해운 분석가 (Shipping Analyst)
> 해운사 전략팀, 항로 계획 및 시장 분석

- **C1**: 말라카 해협과 대한해협의 **현재 통과량을 지도 위에서 시각적으로 비교**하고 싶다. → Mapbox 초크포인트 마커
- **C2**: 특정 항로(예: 인도네시아 → 한국)에서 동일 선종이 10척 이상 동시 운항 중인 경우 **자동 화물 흐름 분석**을 받고 싶다. → CARGO ESTIMATOR 자동 트리거

---

## 5. 기능 요구사항

### P0 — 반드시 구현 (데모 불가 시 실패)

#### F-P0-01: AIS 실시간 스트림 수신 및 지도 렌더링

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/components/MapView.jsx`, `src/hooks/useAISStream.js` |
| **트리거** | 앱 초기 로드 시 |
| **인풋** | `wss://stream.aisstream.io/v0/stream` WebSocket 메시지 |
| **처리** | PositionReport → `ships` Supabase 테이블 upsert (MMSI key), GeoJSON feature 업데이트 |
| **아웃풋** | Mapbox symbol layer에 선박 아이콘 실시간 이동 (최대 10,000개) |
| **수락 기준** | WebSocket 연결 후 30초 내 지도에 1,000척+ 표시, FPS 60 유지 |
| **배치 처리** | 메시지를 500ms 버퍼에 모아 Mapbox `setData()` 1회 호출 (개별 호출 금지) |

```javascript
// useAISStream.js 핵심 로직 구조
const BUFFER_INTERVAL_MS = 500;
let buffer = [];

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.MessageType === 'PositionReport') {
    buffer.push(transformToGeoJSON(msg));
  }
};

setInterval(() => {
  if (buffer.length > 0) {
    mapRef.current.getSource('ships').setData({
      type: 'FeatureCollection',
      features: buffer
    });
    buffer = [];
  }
}, BUFFER_INTERVAL_MS);
```

#### F-P0-02: Supabase ships 테이블 캐시 레이어

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `server/proxy.js` (Node.js WebSocket 프록시) |
| **트리거** | AIS 메시지 수신 시 (30초마다 배치 upsert) |
| **인풋** | AIS PositionReport + ShipStaticData 파싱 결과 |
| **아웃풋** | Supabase `ships` 테이블 upsert |
| **수락 기준** | 30초마다 Supabase에 ships 데이터 반영, 에이전트가 Supabase 쿼리로 현재 선박 상태 조회 가능 |

#### F-P0-03: Command Feed UI 패널

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/components/CommandFeed.jsx`, `src/components/ReportCard.jsx` |
| **트리거** | 에이전트가 `agent_reports` 테이블에 INSERT 시 실시간 반영 (Supabase Realtime) |
| **인풋** | `agent_reports` 테이블 레코드 |
| **아웃풋** | 우측 패널에 보고 카드 최신순 렌더링 |
| **수락 기준** | 새 보고 INSERT 후 2초 내 피드에 카드 등장, severity 배지 색상 정확 |

#### F-P0-04: CARGO ESTIMATOR 선박 클릭 트리거

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/components/ShipDetailPanel.jsx`, `src/agents/cargoEstimator.js` |
| **트리거** | 지도에서 선박 클릭 이벤트 |
| **인풋** | MMSI, vessel_type, destination, draught, max_draught, DWT |
| **아웃풋** | ShipDetailPanel에 화물 추정 결과 렌더링 (Claude API 응답) |
| **수락 기준** | 클릭 후 8초 내 결과 표시, 오류 시 "추정 불가" 메시지 표시 |

#### F-P0-05: ANOMALY DETECTOR 자동 폴링

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/agents/anomalyDetector.js` |
| **트리거** | 2분 interval |
| **인풋** | Supabase `ships` 테이블 쿼리 |
| **아웃풋** | 점수 70+ 선박 탐지 시 `agent_reports` INSERT |
| **수락 기준** | 2분 주기로 실행 확인 (console.log 타임스탬프), 이상 선박 발견 시 CRITICAL 카드 생성 |

---

### P1 — 핵심 경험 (데모 품질 향상)

#### F-P1-01: CHOKEPOINT WATCHER 자동 폴링

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/agents/chokepointWatcher.js` |
| **트리거** | 5분 interval |
| **인풋** | 7개 초크포인트 바운딩박스 내 ships 쿼리 |
| **아웃풋** | 트리거 조건 충족 시 `agent_reports` INSERT |

#### F-P1-02: PORT ANALYST 자동 폴링

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/agents/portAnalyst.js` |
| **트리거** | 10분 interval |
| **인풋** | 8개 항만 반경 내 ships 쿼리 |
| **아웃풋** | 트리거 조건 충족 시 `agent_reports` INSERT |

#### F-P1-03: Commander 자연어 입력 → Orchestrator 라우팅

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/components/CommanderInput.jsx`, `src/agents/orchestrator.js` |
| **트리거** | 사용자 Enter 키 입력 |
| **인풋** | 자연어 텍스트 문자열 |
| **처리** | Claude API에 라우팅 판단 요청 → 해당 에이전트 즉시 실행 |
| **아웃풋** | 관련 에이전트 실행 결과 보고 카드 생성 |
| **수락 기준** | "부산항 상황" 입력 시 PORT ANALYST 5초 내 실행 |

#### F-P1-04: 비교 수치 시스템 (베이스라인 계산)

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/utils/baseline.js` |
| **트리거** | 30분마다 스냅샷 저장 (Supabase `baselines` 테이블) |
| **인풋** | 초크포인트/항만 현재 수치 |
| **아웃풋** | 3개월 rolling 평균, 변화율 계산 |
| **초기값** | 하드코딩된 업계 평균 (섹션 8.4 참조) |

#### F-P1-05: 초크포인트 Mapbox 펄스 애니메이션 마커

| 항목 | 내용 |
|------|------|
| **컴포넌트** | `src/components/ChokepointMarker.jsx` |
| **인풋** | 초크포인트별 최신 severity |
| **아웃풋** | CRITICAL=빨강 펄스, WARNING=노랑 펄스, 정상=흰색 정적 원 |
| **구현 방법** | CSS `@keyframes pulse` + Mapbox custom HTML marker |

---

### P2 — 향후 고도화

| 기능 | 이유 |
|------|------|
| GEOPOLITICAL LINKER (NewsAPI) | NewsAPI 연동 + 상관분석 로직이 Day 5에 집중, 부분 구현으로 데모 가능 |
| 항만 혼잡도 히트맵 오버레이 | Mapbox heatmap layer 추가 작업 필요 |
| 전년 동기 비교 데이터 | 1주 이상 데이터 누적 필요 |
| 기상/해류 오버레이 | 외부 API 추가 |
| 선박 추적 항적 표시 (trail) | 성능 최적화 필요 |
| 다크/라이트 테마 전환 | 해양 다크 테마로 고정 |

---

## 6. 에이전트별 상세 스펙

> 모든 에이전트는 `src/agents/` 디렉토리에 위치.
> 공통 인터페이스: `async run(context) → ReportCard | null`

### 6.0 에이전트 공통 인터페이스

```typescript
// types/agent.ts
interface ReportCard {
  agent_id: 'PORT_ANALYST' | 'CHOKEPOINT_WATCHER' | 'CARGO_ESTIMATOR' | 'ANOMALY_DETECTOR' | 'GEOPOLITICAL_LINKER';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;           // 최대 60자
  summary: string;         // 최대 120자
  detail: string;          // Markdown 형식, Claude 생성
  data_points: DataPoint[]; // 핵심 수치 2-3개
  annotations: string[];   // 근거 주석
  related_mmsi: string[];  // 연관 선박 MMSI
  location?: { lat: number; lng: number; zoom: number }; // 지도 포커스
}

interface DataPoint {
  label: string;
  current: number;
  baseline: number;
  unit: string;
  change_pct: number;
  direction: 'UP' | 'DOWN' | 'STABLE';
}
```

```javascript
// agents/baseAgent.js — 모든 에이전트가 상속
class BaseAgent {
  constructor(agentId, pollIntervalMs) {
    this.agentId = agentId;
    this.pollIntervalMs = pollIntervalMs;
    this.lastRunAt = null;
  }

  async callClaude(systemPrompt, userMessage) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const data = await response.json();
    return data.content[0].text;
  }

  async saveReport(card) {
    await supabase.from('agent_reports').insert({
      agent_id: card.agent_id,
      severity: card.severity,
      title: card.title,
      summary: card.summary,
      detail: card.detail,
      data_points: card.data_points,
      annotations: card.annotations,
      related_mmsi: card.related_mmsi,
      location: card.location,
      created_at: new Date().toISOString()
    });
  }

  startPolling() {
    setInterval(() => this.run(), this.pollIntervalMs);
  }
}
```

---

### 6.1 Agent 1: PORT ANALYST

**파일**: `src/agents/portAnalyst.js`
**폴링 주기**: 600,000ms (10분)

#### 모니터링 항만 좌표 (하드코딩)

```javascript
const PORTS = [
  { id: 'busan',      name: '부산항',      lat: 35.1028, lng: 129.0403, radius_nm: 15 },
  { id: 'incheon',    name: '인천항',      lat: 37.4563, lng: 126.6078, radius_nm: 12 },
  { id: 'gwangyang',  name: '광양항',      lat: 34.9333, lng: 127.7167, radius_nm: 10 },
  { id: 'singapore',  name: '싱가포르항',  lat: 1.2654,  lng: 103.8198, radius_nm: 20 },
  { id: 'shanghai',   name: '상하이항',    lat: 31.2304, lng: 121.4737, radius_nm: 25 },
  { id: 'rotterdam',  name: '로테르담항',  lat: 51.9225, lng: 4.4792,   radius_nm: 20 },
  { id: 'la_lb',      name: 'LA/LB항',    lat: 33.7701, lng: -118.1937,radius_nm: 20 },
  { id: 'dubai',      name: '두바이항',    lat: 25.2048, lng: 55.2708,  radius_nm: 15 },
];
```

#### 트리거 로직 의사코드

```javascript
async function runPortAnalyst() {
  for (const port of PORTS) {
    // 1. 반경 내 선박 쿼리 (위경도 바운딩박스 근사)
    const ships = await supabase
      .from('ships')
      .select('*')
      .gte('lat', port.lat - nmToDeg(port.radius_nm))
      .lte('lat', port.lat + nmToDeg(port.radius_nm))
      .gte('lng', port.lng - nmToDeg(port.radius_nm))
      .lte('lng', port.lng + nmToDeg(port.radius_nm));

    const waitingShips = ships.filter(s => s.speed <= 2.0); // knot
    const currentCount = waitingShips.length;

    // 2. 베이스라인 조회
    const baseline = await getBaseline(port.id, 'waiting_ships');
    const avg90d = baseline?.avg_90d ?? HARDCODED_BASELINE[port.id].waiting_ships;

    // 3. 트리거 판단
    const triggers = {
      countSurge: currentCount > avg90d * 1.4,           // +40% 이상
      longWait:   estimateWaitHours(waitingShips) > 6,   // 6시간 초과
      vesselTypeSurge: checkVesselTypeDrift(ships) > 15  // ±15%p 변화
    };

    if (Object.values(triggers).some(Boolean)) {
      const report = await generatePortReport(port, ships, waitingShips, avg90d, triggers);
      await saveReport(report);
    }
  }
}
```

#### System Prompt (Claude API)

```
You are PORT ANALYST, a maritime intelligence agent specializing in port congestion analysis.

You receive real-time AIS data for a specific port and must generate a concise intelligence report in Korean.

STRICT OUTPUT FORMAT (respond only with valid JSON):
{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[항만명] [상황 요약] (최대 30자)",
  "summary": "핵심 수치 포함 1-2문장 요약 (최대 80자)",
  "detail": "Markdown 형식 상세 분석 (최대 400자)",
  "ai_comment": "변화 원인 추정 및 운영 시사점 (최대 200자)"
}

SEVERITY RULES:
- CRITICAL: 대기 선박 수 평균 +60% 이상 OR 평균 대기시간 12시간 이상
- WARNING: 대기 선박 수 평균 +40% 이상 OR 평균 대기시간 6시간 이상
- INFO: 그 외 트리거 조건 충족 시

Always include:
1. 현재 대기 선박 수 vs 90일 평균 수치 (숫자 명시)
2. 선종 분포 변화 (컨테이너/탱커/벌크/기타 %)
3. 평균 대기시간 추정치 (시간 단위)
4. 원인 추정 (계절/기상/지정학적/운항 이슈 중 해당 항목)

Do NOT use vague expressions. Always cite specific numbers.
```

---

### 6.2 Agent 2: CHOKEPOINT WATCHER

**파일**: `src/agents/chokepointWatcher.js`
**폴링 주기**: 300,000ms (5분)

#### 초크포인트 바운딩박스 (하드코딩)

```javascript
const CHOKEPOINTS = [
  {
    id: 'suez',
    name: '수에즈 운하',
    bbox: [[31.8, 29.9], [33.1, 31.3]], // [SW, NE] [lng, lat]
    daily_avg: 58,
    detour_indicator: 'cape_of_good_hope' // 우회 항로 감지용
  },
  {
    id: 'malacca',
    name: '말라카 해협',
    bbox: [[99.5, 1.0], [104.5, 6.5]],
    daily_avg: 247,
    detour_indicator: null
  },
  {
    id: 'hormuz',
    name: '호르무즈 해협',
    bbox: [[55.5, 25.8], [57.5, 27.0]],
    daily_avg: 89,
    detour_indicator: null
  },
  {
    id: 'panama',
    name: '파나마 운하',
    bbox: [[79.5, 8.8], [80.2, 9.5]],
    daily_avg: 35,
    detour_indicator: null
  },
  {
    id: 'dover',
    name: '영불 해협',
    bbox: [[-2.0, 50.5], [2.5, 51.5]],
    daily_avg: 312,
    detour_indicator: null
  },
  {
    id: 'korea_strait',
    name: '대한해협',
    bbox: [[128.5, 33.5], [130.5, 35.0]],
    daily_avg: 156,
    detour_indicator: null
  },
  {
    id: 'bab_el_mandeb',
    name: '바브엘만데브',
    bbox: [[43.0, 11.5], [44.5, 13.0]],
    daily_avg: 67,
    detour_indicator: null
  },
];
```

#### 트리거 로직 의사코드

```javascript
async function runChokepointWatcher() {
  for (const cp of CHOKEPOINTS) {
    // 현재 통과량 — ships 테이블 기준 (최신 위치, 5분 이내 업데이트된 선박만)
    const shipsNow = await queryShipsInBbox(cp.bbox);
    const hourlyRate = shipsNow.length;
    const dailyEstimate = hourlyRate * 24;

    const baseline = await getBaseline(cp.id, 'daily_throughput');
    const avg90d = baseline?.avg_90d ?? cp.daily_avg;

    // 이전 5분 스냅샷은 baselines 테이블에서 조회 (ship_positions 이력 테이블 필요 없음)
    const prevSnapshot = await getPrevBaseline(cp.id, 'hourly_throughput', 60); // 1시간 전 값
    const prevHourlyRate = prevSnapshot?.current_value ?? hourlyRate;

    const triggers = {
      dailyDrop:  dailyEstimate < avg90d * 0.75,
      suddenDrop: prevHourlyRate > 0 && (hourlyRate / prevHourlyRate) < 0.5,
      // detour 감지: Cape of Good Hope 경유 탱커 급증 시 수에즈 우회 추정
      // (ship_positions 이력 없이) 현재 해당 bbox 선박 수가 기준치 +50% 초과 여부로 판단
      detourDetected: cp.detour_indicator
                      ? (await queryShipsInBbox(DETOUR_BBOXES[cp.detour_indicator])).length
                        > (DETOUR_BASELINES[cp.detour_indicator] * 1.5)
                      : false
    };

    if (Object.values(triggers).some(Boolean)) {
      const severity = triggers.dailyDrop && triggers.suddenDrop ? 'CRITICAL' : 'WARNING';
      const report = await generateChokepointReport(cp, shipsNow, dailyEstimate, avg90d, triggers, severity);
      await saveReport(report);
    }
  }
}
// NOTE: queryShipsInBbox = Supabase 위경도 바운딩박스 쿼리 (geoUtils.nmToDeg 사용)
// NOTE: getPrevBaseline = baselines 테이블에서 N분 전 current_value 조회
```

#### System Prompt (Claude API)

```
You are CHOKEPOINT WATCHER, a maritime intelligence agent monitoring critical global shipping chokepoints.

Respond ONLY with valid JSON. Language: Korean.

{
  "severity": "WARNING|CRITICAL",
  "title": "[초크포인트명] 통과량 이상 감지 (최대 30자)",
  "summary": "통과량 수치 포함 핵심 요약 (최대 80자)",
  "detail": "## 현황\n[내용]\n## 원인 분석\n[내용]\n## 공급망 리스크\n[내용]",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "ai_comment": "과거 유사 패턴과 비교 및 권고사항 (최대 250자)"
}

ALWAYS include in detail:
1. 현재 통과량 (척/일 추정) vs 90일 평균 vs 전년 동기 (가용 시)
2. 우회 항로 선박 수 변화 (해당 시)
3. 공급망 리스크 등급 (LOW/MEDIUM/HIGH/CRITICAL) 및 근거
4. 과거 유사 사례 1건 이상 언급 (2021 수에즈 봉쇄, 2023 파나마 가뭄 등)

Cite specific numbers for every claim. No vague language.
```

---

### 6.3 Agent 3: CARGO ESTIMATOR

**파일**: `src/agents/cargoEstimator.js`
**트리거**: 수동(선박 클릭) + 자동(동일 항로 10척+, PORT ANALYST 연동)

#### 내장 정적 데이터 (UN Comtrade 기반)

```javascript
// data/tradePairs.js — 주요 교역 쌍별 주요 품목
const TRADE_PAIRS = {
  'ID_KR': { // 인도네시아 → 한국
    top_cargo: [
      { name: '니켈 광석/제품', hs_code: '7502', share_pct: 38, margin: 8 },
      { name: '석탄', hs_code: '2701', share_pct: 25, margin: 5 },
      { name: '팜유', hs_code: '1511', share_pct: 15, margin: 6 },
      { name: '고무', hs_code: '4001', share_pct: 12, margin: 7 },
    ],
    source: 'UN Comtrade 2023'
  },
  'AU_KR': {
    top_cargo: [
      { name: '철광석', hs_code: '2601', share_pct: 42, margin: 6 },
      { name: 'LNG', hs_code: '2711', share_pct: 30, margin: 5 },
      { name: '석탄', hs_code: '2701', share_pct: 18, margin: 5 },
    ],
    source: 'UN Comtrade 2023'
  },
  // ... 주요 30개 교역 쌍 내장
};

// data/seasonalIndex.js — 월별 품목 성수기 가중치
const SEASONAL_INDEX = {
  'LNG': [1.3, 1.2, 1.0, 0.8, 0.7, 0.7, 0.7, 0.8, 1.0, 1.1, 1.2, 1.4], // Jan-Dec
  'GRAIN': [0.8, 0.8, 1.0, 1.2, 1.3, 1.1, 0.9, 0.8, 0.9, 1.0, 1.1, 1.0],
  // ...
};
```

#### 트리거 로직 의사코드

```javascript
async function runCargoEstimator(mmsi, triggerType = 'MANUAL') {
  const ship = await supabase.from('ships').select('*').eq('mmsi', mmsi).single();
  
  if (!ship) return null;

  const tradePairKey = `${ship.origin_country}_${ship.destination_country}`;
  const tradePair = TRADE_PAIRS[tradePairKey] ?? null;
  
  const loadRatio = ship.draught / ship.max_draught; // 흘수 비율
  const estimatedLoad = ship.dwt * loadRatio;        // 추정 적재량 (톤)
  const currentMonth = new Date().getMonth();         // 0-indexed

  const prompt = buildCargoPrompt(ship, tradePair, estimatedLoad, currentMonth);
  const result = await callClaude(CARGO_SYSTEM_PROMPT, prompt);
  
  return parseCargoResult(result, ship, estimatedLoad);
}
```

#### System Prompt (Claude API)

```
You are CARGO ESTIMATOR, a maritime cargo intelligence agent.

Given vessel AIS data and trade statistics, estimate the probable cargo composition.

Respond ONLY with valid JSON. Language: Korean.

{
  "cargo_distribution": [
    {
      "item": "품목명",
      "probability_pct": 38,
      "margin_pct": 8,
      "annotation": "[1] 근거: UN Comtrade 2023 인니→한국 수출 1위, HS Code 7502"
    }
  ],
  "estimated_load_tons": 45000,
  "load_ratio_pct": 78,
  "confidence": "HIGH|MEDIUM|LOW",
  "disclaimer": "본 추정은 공개 무역 통계와 AIS 데이터를 기반으로 한 확률적 추정이며, 실제 화물과 다를 수 있습니다.",
  "data_sources": ["UN Comtrade 2023", "AIS 흘수 데이터", "계절 인덱스"]
}

MANDATORY:
1. Every cargo item MUST have an annotation with data source and reasoning
2. Probabilities must sum to 100%
3. Include disclaimer at the bottom
4. Use seasonal index adjustments when applicable
5. If trade pair data unavailable, use vessel_type + destination region heuristics and note the reduced confidence

FORBIDDEN: Stating cargo without citing a basis. No hallucinated percentages.
```

---

### 6.4 Agent 4: ANOMALY DETECTOR

**파일**: `src/agents/anomalyDetector.js`
**폴링 주기**: 120,000ms (2분)

#### 점수 계산 로직 의사코드

```javascript
const ANOMALY_SCORES = {
  AIS_DISAPPEAR_30MIN:  30, // AIS 30분+ 소실 후 재등장
  DESTINATION_DEVIATION: 25, // 선언 목적지 vs 실제 항로 50nm+ 편차
  CHOKEPOINT_LOITERING:  20, // 초크포인트 인근 3시간+ 배회
  LOW_SPEED:             15, // 속도 선종 평균 -60% 이하
  NIGHT_AIS_BREAK:       25, // 야간 AIS 반복 단절 2회+
  PRIOR_ANOMALY_HISTORY: 20, // 동일 MMSI 과거 이상행동 이력
};

const VESSEL_AVG_SPEEDS = {
  'Container Ship': 20, 'Tanker': 14, 'Bulk Carrier': 12,
  'General Cargo': 13, 'LNG Carrier': 17, 'default': 12
};

async function runAnomalyDetector() {
  const ships = await supabase.from('ships').select('*')
    .gte('updated_at', new Date(Date.now() - 3600000).toISOString()); // 최근 1시간

  const suspects = [];

  for (const ship of ships) {
    let score = 0;
    const detectedFlags = [];

    // ship_positions 이력 조회 (2시간치)
    const { data: positions } = await supabase
      .from('ship_positions')
      .select('lat, lng, speed, recorded_at')
      .eq('mmsi', ship.mmsi)
      .gte('recorded_at', new Date(Date.now() - 7200000).toISOString())
      .order('recorded_at', { ascending: true });

    // 1. AIS 소실 감지 — 이력 기반: 30분 이상 위치 기록 공백 확인
    if (positions && positions.length >= 2) {
      for (let i = 1; i < positions.length; i++) {
        const gap = new Date(positions[i].recorded_at) - new Date(positions[i-1].recorded_at);
        if (gap > 30 * 60 * 1000) {
          score += ANOMALY_SCORES.AIS_DISAPPEAR_30MIN;
          detectedFlags.push({ flag: 'AIS_DISAPPEAR_30MIN', score: 30, detail: `${Math.round(gap/60000)}분 공백` });
          break;
        }
      }
    }

    // 2. 목적지 편차 — 현재 위치가 선언 목적지 항구 방향과 50nm 이상 벗어났는지
    if (ship.destination && ship.dest_country) {
      const destPort = lookupPortCoords(ship.destination, ship.dest_country);
      if (destPort) {
        const expectedBearing = calcBearing(ship.lat, ship.lng, destPort.lat, destPort.lng);
        const bearingDiff = Math.abs(expectedBearing - (ship.course ?? ship.heading ?? 0));
        const deviation = distanceNm(ship.lat, ship.lng, destPort.lat, destPort.lng)
                        * Math.sin(bearingDiff * Math.PI / 180);
        if (deviation > 50) {
          score += ANOMALY_SCORES.DESTINATION_DEVIATION;
          detectedFlags.push({ flag: 'DESTINATION_DEVIATION', score: 25, detail: `${Math.round(deviation)}nm 편차` });
        }
      }
    }

    // 3. 배회 감지 — 이력 기반: 2시간 동안 반경 5nm 내에서 맴돌기
    if (positions && positions.length >= 4) {
      const maxDispNm = Math.max(...positions.map(p =>
        distanceNm(positions[0].lat, positions[0].lng, p.lat, p.lng)
      ));
      const durationHours = (new Date(positions.at(-1).recorded_at) - new Date(positions[0].recorded_at)) / 3600000;
      if (maxDispNm < 5 && durationHours >= 2) {
        score += ANOMALY_SCORES.CHOKEPOINT_LOITERING;
        detectedFlags.push({ flag: 'CHOKEPOINT_LOITERING', score: 20, detail: `${durationHours.toFixed(1)}h 반경 ${maxDispNm.toFixed(1)}nm` });
      }
    }

    // 4. 저속 — 현재 ships 테이블 speed 값으로 판단 (이력 불필요)
    const avgSpeed = VESSEL_AVG_SPEEDS[ship.vessel_type] ?? VESSEL_AVG_SPEEDS.default;
    if (ship.speed !== null && ship.speed < avgSpeed * 0.4) {
      score += ANOMALY_SCORES.LOW_SPEED;
      detectedFlags.push({ flag: 'LOW_SPEED', score: 15, detail: `${ship.speed}knot (평균 ${avgSpeed}knot의 ${Math.round(ship.speed/avgSpeed*100)}%)` });
    }

    // 5. 야간 AIS 단절 — ship_positions 이력에서 UTC 22:00-06:00 구간 공백 카운트
    if (positions) {
      let nightBreaks = 0;
      for (let i = 1; i < positions.length; i++) {
        const gap = new Date(positions[i].recorded_at) - new Date(positions[i-1].recorded_at);
        const hour = new Date(positions[i-1].recorded_at).getUTCHours();
        if (gap > 20 * 60 * 1000 && (hour >= 22 || hour < 6)) nightBreaks++;
      }
      if (nightBreaks >= 2) {
        score += ANOMALY_SCORES.NIGHT_AIS_BREAK;
        detectedFlags.push({ flag: 'NIGHT_AIS_BREAK', score: 25, detail: `${nightBreaks}회 야간 단절` });
      }
    }

    // 6. 과거 이력 — anomaly_history 테이블 (ships 테이블과 무관)
    const { count: historyCount } = await supabase
      .from('anomaly_history').select('*', { count: 'exact', head: true })
      .eq('mmsi', ship.mmsi);
    if (historyCount > 0) {
      score += ANOMALY_SCORES.PRIOR_ANOMALY_HISTORY;
      detectedFlags.push({ flag: 'PRIOR_ANOMALY_HISTORY', score: 20, detail: `${historyCount}건 이력` });
    }

    if (score >= 70) {
      suspects.push({ ship, score, flags: detectedFlags });
    }
  }

  for (const suspect of suspects) {
    const report = await generateAnomalyReport(suspect);
    await saveReport(report);
  }
}
// NOTE: distanceNm, calcBearing, lookupPortCoords는 geoUtils.js에 구현
```

#### System Prompt (Claude API)

```
You are ANOMALY DETECTOR, a maritime security intelligence agent specializing in vessel behavior analysis.

Analyze suspicious vessel behavior based on AIS anomaly scoring data.

Respond ONLY with valid JSON. Language: Korean.

{
  "severity": "WARNING|CRITICAL",
  "title": "[선명 or MMSI] 이상행동 탐지 (최대 30자)",
  "summary": "탐지된 주요 이상행동 + 리스크 점수 (최대 80자)",
  "anomaly_type": "DARK_SHIP|SPOOFING|LOITERING|SMUGGLING|PIRACY_RISK|UNKNOWN",
  "risk_score": 75,
  "score_breakdown": [
    { "flag": "AIS_DISAPPEAR_30MIN", "score": 30, "description": "30분 AIS 소실 후 재등장" }
  ],
  "possible_causes": ["제재 회피", "불법 환적 가능성", "기술적 오류"],
  "detail": "상세 분석 Markdown",
  "ai_comment": "이상행동 유형 분류 및 모니터링 권고사항 (최대 200자)"
}

SEVERITY: score 70-89 = WARNING, score 90+ = CRITICAL

Always include all detected flags with individual scores and total.
Classify anomaly type based on combination of flags.
Note: AIS malfunction is always a possible cause — do not assume malicious intent without strong evidence.
```

---

### 6.5 Agent 5: GEOPOLITICAL LINKER

**파일**: `src/agents/geopoliticalLinker.js`
**폴링 주기**: 900,000ms (15분)

#### 트리거 로직 의사코드

```javascript
const NEWS_KEYWORDS = [
  'strait', 'canal', 'shipping', 'sanctions', 'port', 'blockade',
  'attack', 'tanker', '해협', '항만', '제재', '봉쇄', '선박'
];

async function runGeopoliticalLinker() {
  // 1. NewsAPI 쿼리
  const newsQuery = NEWS_KEYWORDS.join(' OR ');
  const news = await fetchNewsAPI({
    q: newsQuery,
    language: 'en,ko',
    sortBy: 'publishedAt',
    from: new Date(Date.now() - 900000).toISOString() // 지난 15분
  });

  if (news.articles.length === 0) return null;

  // 2. 최근 15분 내 CHOKEPOINT WATCHER 보고 확인
  const recentChokepointReports = await supabase
    .from('agent_reports')
    .select('*')
    .eq('agent_id', 'CHOKEPOINT_WATCHER')
    .gte('created_at', new Date(Date.now() - 900000).toISOString());

  // 3. 연관성 판단
  const hasChokepointAlert = recentChokepointReports.data?.length > 0;
  const hasMaritimeNews = news.articles.some(a =>
    NEWS_KEYWORDS.some(kw => a.title.toLowerCase().includes(kw))
  );

  // hasMovementAnomaly: 최근 15분 내 ANOMALY_DETECTOR 또는 CHOKEPOINT_WATCHER 보고 여부로 판단
  const recentAnomalyReports = await supabase
    .from('agent_reports')
    .select('id', { count: 'exact', head: true })
    .in('agent_id', ['ANOMALY_DETECTOR', 'CHOKEPOINT_WATCHER'])
    .gte('created_at', new Date(Date.now() - 900000).toISOString());

  const hasMovementAnomaly = (recentAnomalyReports.count ?? 0) > 0;

  if (hasMaritimeNews && (hasChokepointAlert || hasMovementAnomaly)) {
    const report = await generateGeopoliticalReport(news.articles, recentChokepointReports.data);
    await saveReport(report);
  }
}
// NOTE: fetchMaritimeNews는 /api/news 프록시 엔드포인트를 통해 호출 (section 8.4 참조)
// NewsAPI는 브라우저 직접 호출 시 CORS 오류 — 반드시 Node.js 프록시 경유 필요
```

#### System Prompt (Claude API)

```
You are GEOPOLITICAL LINKER, a maritime geopolitical intelligence agent connecting news events to shipping data.

Respond ONLY with valid JSON. Language: Korean.

{
  "severity": "INFO|WARNING|CRITICAL",
  "title": "[지역/이슈] 지정학적 리스크 → 해운 연관 (최대 30자)",
  "summary": "뉴스 이벤트 + 해운 데이터 상관관계 요약 (최대 80자)",
  "news_items": [
    {
      "headline": "기사 제목",
      "source": "출처",
      "published_at": "ISO 8601",
      "relevance": "HIGH|MEDIUM|LOW"
    }
  ],
  "shipping_impact": {
    "affected_routes": ["수에즈 북행", "호르무즈 동행"],
    "data_correlation": "뉴스 발생 후 해운 데이터 변화 수치",
    "korea_supply_chain_risk": "한국 공급망 영향 예측 (HIGH/MEDIUM/LOW)"
  },
  "historical_pattern": "유사 과거 사례 및 결과 (최대 150자)",
  "recommendation": "모니터링 권고사항 (최대 100자)"
}

CRITICAL rule: Only correlate news to shipping data that actually changed. Do not invent correlations.
Always assess Korea-specific supply chain impact (Korea imports 97% of energy by sea).
```

---

### 6.6 Orchestrator

**파일**: `src/agents/orchestrator.js`

```javascript
const ORCHESTRATOR_SYSTEM_PROMPT = `
You are the Seabird Orchestrator.
Your job is to parse user natural language queries and route them to the correct agents.

Respond ONLY with valid JSON:
{
  "agents": ["PORT_ANALYST", "CARGO_ESTIMATOR"],  // 실행할 에이전트 목록
  "params": {
    "port_id": "busan",     // PORT_ANALYST에 전달
    "mmsi": "123456789"     // CARGO_ESTIMATOR/ANOMALY_DETECTOR에 전달
  },
  "user_message": "처리 결과를 기다리는 중입니다..."
}

ROUTING RULES:
- 항만/항구/port/congestion → PORT_ANALYST
- MMSI/선박명/vessel/ship + 화물/cargo/적재 → CARGO_ESTIMATOR
- MMSI/선박명/vessel/ship + 위험/리스크/이상/anomaly → ANOMALY_DETECTOR
- 초크포인트/해협/canal/strait → CHOKEPOINT_WATCHER
- 뉴스/제재/지정학/geopolitical → GEOPOLITICAL_LINKER
- 복합 질문 → 여러 에이전트 동시 실행

Port ID mappings: 부산=busan, 인천=incheon, 광양=gwangyang, 싱가포르=singapore, 
                  상하이=shanghai, 로테르담=rotterdam, LA=la_lb, 두바이=dubai
`;
```

---

## 7. 데이터 모델

### 7.1 Supabase 스키마 (PostgreSQL)

```sql
-- ships: AIS 현재 상태 캐시 (MMSI별 최신 1건)
CREATE TABLE ships (
  mmsi            VARCHAR(9) PRIMARY KEY,
  ship_name       VARCHAR(100),
  vessel_type     VARCHAR(50),     -- 'Container Ship', 'Tanker', 'Bulk Carrier', 'General Cargo', 'LNG Carrier', 'Other'
  lat             DECIMAL(9, 6)    NOT NULL,
  lng             DECIMAL(9, 6)    NOT NULL,
  speed           DECIMAL(5, 2),   -- knots
  heading         SMALLINT,        -- 0-359 degrees
  course          SMALLINT,        -- 0-359 degrees
  draught         DECIMAL(4, 1),   -- meters (현재 흘수)
  max_draught     DECIMAL(4, 1),   -- meters (최대 흘수)
  dwt             INTEGER,         -- 재화중량톤수 (deadweight tonnage)
  destination     VARCHAR(100),
  eta             TIMESTAMP,
  flag_country    VARCHAR(3),      -- ISO 3166-1 alpha-3
  imo             VARCHAR(7),
  call_sign       VARCHAR(8),
  origin_country  VARCHAR(3),      -- 출발국 추정 (AIS 없으면 null)
  dest_country    VARCHAR(3),      -- 도착국 추정
  updated_at      TIMESTAMP        NOT NULL DEFAULT NOW()
);

-- 인덱스: 에이전트 공간 쿼리 최적화
CREATE INDEX idx_ships_location ON ships (lat, lng);
CREATE INDEX idx_ships_vessel_type ON ships (vessel_type);
CREATE INDEX idx_ships_speed ON ships (speed);
CREATE INDEX idx_ships_updated_at ON ships (updated_at);

-- agent_reports: 에이전트 생성 보고 카드
CREATE TABLE agent_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        VARCHAR(30) NOT NULL, -- 'PORT_ANALYST' | 'CHOKEPOINT_WATCHER' | 'CARGO_ESTIMATOR' | 'ANOMALY_DETECTOR' | 'GEOPOLITICAL_LINKER'
  severity        VARCHAR(10) NOT NULL  CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  title           VARCHAR(60) NOT NULL,
  summary         VARCHAR(120) NOT NULL,
  detail          TEXT,                -- Markdown
  data_points     JSONB,               -- DataPoint[] (섹션 6.0 참조)
  annotations     JSONB,               -- string[]
  related_mmsi    JSONB,               -- string[]
  location        JSONB,               -- { lat, lng, zoom }
  raw_data        JSONB,               -- 에이전트 raw 인풋 (디버깅용)
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_reports_agent_id ON agent_reports (agent_id);
CREATE INDEX idx_agent_reports_severity ON agent_reports (severity);
CREATE INDEX idx_agent_reports_created_at ON agent_reports (created_at DESC);

-- ship_positions: AIS 위치 이력 (ANOMALY DETECTOR 의존, 2시간 TTL)
-- proxy.js가 PositionReport 수신 시마다 INSERT, 2시간 초과분 주기적 DELETE
CREATE TABLE ship_positions (
  id              BIGSERIAL PRIMARY KEY,
  mmsi            VARCHAR(9) NOT NULL,
  lat             DECIMAL(9, 6) NOT NULL,
  lng             DECIMAL(9, 6) NOT NULL,
  speed           DECIMAL(5, 2),
  recorded_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ship_positions_mmsi_time ON ship_positions (mmsi, recorded_at DESC);

-- TTL 유지: proxy.js 내 주기적 정리 (1시간마다)
-- DELETE FROM ship_positions WHERE recorded_at < NOW() - INTERVAL '2 hours';

-- baselines: 30분 스냅샷 누적 + 90일 이동 평균
CREATE TABLE baselines (
  id              BIGSERIAL PRIMARY KEY,
  location_id     VARCHAR(30) NOT NULL, -- 'busan', 'suez', 'malacca' 등
  metric          VARCHAR(50) NOT NULL, -- 'waiting_ships', 'daily_throughput', 'vessel_type_ratio_container'
  current_value   DECIMAL(12, 4) NOT NULL,
  avg_90d         DECIMAL(12, 4),       -- NULL이면 하드코딩 기본값 사용
  snapshot_at     TIMESTAMP NOT NULL DEFAULT NOW()
  -- UNIQUE 제거: 동일 시각 복수 INSERT 충돌 방지 (PRIMARY KEY로 고유성 보장)
);

CREATE INDEX idx_baselines_location_metric ON baselines (location_id, metric);
CREATE INDEX idx_baselines_snapshot_at ON baselines (snapshot_at DESC);

-- anomaly_history: ANOMALY DETECTOR 이상행동 이력
CREATE TABLE anomaly_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mmsi            VARCHAR(9) NOT NULL,
  anomaly_type    VARCHAR(30) NOT NULL,
  risk_score      SMALLINT NOT NULL,
  flags           JSONB NOT NULL,       -- 감지된 이상 항목 배열
  report_id       UUID REFERENCES agent_reports(id),
  detected_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anomaly_history_mmsi ON anomaly_history (mmsi);
```

### 7.2 하드코딩 베이스라인 기본값

```javascript
// data/hardcodedBaselines.js
export const HARDCODED_BASELINE = {
  ports: {
    busan:      { waiting_ships: 12, avg_wait_hours: 3.2 },
    incheon:    { waiting_ships: 8,  avg_wait_hours: 2.8 },
    gwangyang:  { waiting_ships: 5,  avg_wait_hours: 2.1 },
    singapore:  { waiting_ships: 45, avg_wait_hours: 4.5 },
    shanghai:   { waiting_ships: 80, avg_wait_hours: 5.2 },
    rotterdam:  { waiting_ships: 35, avg_wait_hours: 3.8 },
    la_lb:      { waiting_ships: 40, avg_wait_hours: 4.1 },
    dubai:      { waiting_ships: 20, avg_wait_hours: 3.5 },
  },
  chokepoints: {
    suez:         { daily_throughput: 58 },
    malacca:      { daily_throughput: 247 },
    hormuz:       { daily_throughput: 89 },
    panama:       { daily_throughput: 35 },
    dover:        { daily_throughput: 312 },
    korea_strait: { daily_throughput: 156 },
    bab_el_mandeb:{ daily_throughput: 67 },
  }
};
```

---

## 8. API 연동 스펙

### 8.1 aisstream.io WebSocket

**엔드포인트**: `wss://stream.aisstream.io/v0/stream`

```javascript
// server/proxy.js
const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

ws.onopen = () => {
  ws.send(JSON.stringify({
    APIKey: process.env.AISSTREAM_API_KEY,
    MessageTypes: ['PositionReport', 'ShipStaticData'],
    BoundingBoxes: [
      // 전세계 커버리지 (성능 위해 두 박스로 분할)
      [[-180, -90], [0, 90]],
      [[0, -90], [180, 90]]
    ]
  }));
};

// PositionReport 파싱
function parsePositionReport(msg) {
  const m = msg.Message.PositionReport;
  return {
    mmsi:      String(m.UserID),
    lat:       m.Latitude,
    lng:       m.Longitude,
    speed:     m.Sog,      // Speed over Ground (knots)
    heading:   m.TrueHeading !== 511 ? m.TrueHeading : m.Cog,
    course:    m.Cog,
    updated_at: new Date().toISOString()
  };
}

// ShipStaticData 파싱
function parseShipStaticData(msg) {
  const m = msg.Message.ShipStaticData;
  const mmsi = String(m.UserID);
  const destination = m.Destination?.trim();

  return {
    mmsi,
    ship_name:    m.Name?.trim(),
    vessel_type:  mapAISTypeToCategory(m.Type),
    destination,
    eta:          parseETA(m.Eta),
    draught:      m.MaximumStaticDraught,
    call_sign:    m.CallSign?.trim(),
    imo:          m.ImoNumber ? String(m.ImoNumber) : null,
    flag_country: mmsiToFlag(mmsi),
    // origin_country: flag_country로 추정 (출발 항구 AIS 미제공이므로 차선책)
    // 더 정확한 추정은 선박이 마지막으로 정박한 항구의 국가코드를 사용하나, 해커톤 범위 초과
    origin_country: mmsiToFlag(mmsi),
    dest_country:  destination ? inferCountryFromPort(destination) : null,
  };
}
// inferCountryFromPort: 항구명에서 ISO-3 국가코드 추정 (utils/aisParser.js)
// 예: 'BUSAN', 'KRPUS', 'BUSAN KR' → 'KOR' / 'SINGAPORE', 'SGSIN' → 'SGP'
// 일치 항구 없으면 null 반환 → CARGO ESTIMATOR에서 vessel_type 기반 휴리스틱으로 폴백
```

**AIS 선종 코드 매핑**:
```javascript
function mapAISTypeToCategory(typeCode) {
  if (typeCode >= 72 && typeCode <= 74) return 'Bulk Carrier';   // Bulk 먼저 (70-79 범위 내 서브셋)
  if (typeCode >= 70 && typeCode <= 79) return 'Container Ship';
  if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
  if (typeCode === 84 || typeCode === 85) return 'LNG Carrier';  // Tanker 하위, 순서 주의: 위 Tanker 조건 이전에 넣을 것
  if (typeCode >= 50 && typeCode <= 59) return 'Special Craft';
  if (typeCode >= 30 && typeCode <= 39) return 'Fishing';
  return 'Other';
}
// ⚠️ 주의: LNG Carrier(84,85)를 분리하려면 Tanker 조건 앞으로 이동해야 함.
// 해커톤 범위에서는 LNG를 Tanker에 포함시켜도 무방.
```

### 8.2 Claude API

**엔드포인트**: `https://api.anthropic.com/v1/messages`
**모델**: `claude-sonnet-4-6`
**API Key 환경변수**: `ANTHROPIC_API_KEY` (Vite: `VITE_ANTHROPIC_API_KEY`)

```javascript
// utils/claudeClient.js
export async function callClaude({ systemPrompt, userMessage, maxTokens = 1000 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  // JSON 파싱 (모든 에이전트는 JSON 반환)
  try {
    const clean = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    throw new Error(`JSON parse failed: ${text.substring(0, 200)}`);
  }
}
```

**에이전트별 max_tokens 설정**:
| 에이전트 | max_tokens | 이유 |
|----------|-----------|------|
| PORT_ANALYST | 800 | 항만 보고 중간 분량 |
| CHOKEPOINT_WATCHER | 800 | 유사 |
| CARGO_ESTIMATOR | 1200 | 품목 분포 + 근거 주석 많음 |
| ANOMALY_DETECTOR | 800 | 점수 breakdown 포함 |
| GEOPOLITICAL_LINKER | 1000 | 뉴스 항목 + 분석 |
| ORCHESTRATOR | 300 | 라우팅만 |

### 8.3 Mapbox GL JS

**API Key 환경변수**: `VITE_MAPBOX_TOKEN`

```javascript
// components/MapView.jsx 핵심 설정
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [127.0, 35.0], // 한국 중심 초기값
  zoom: 4,
  antialias: true        // WebGL 안티앨리어싱
});

// 선종별 아이콘 색상
const VESSEL_COLORS = {
  'Container Ship': '#3B82F6', // 파랑
  'Tanker':         '#EF4444', // 빨강
  'Bulk Carrier':   '#EAB308', // 노랑
  'Other':          '#FFFFFF', // 흰색
};

// GeoJSON symbol layer 설정
map.addLayer({
  id: 'ships-layer',
  type: 'symbol',
  source: 'ships',
  layout: {
    'icon-image': 'triangle',       // 커스텀 방향 삼각형 아이콘
    'icon-rotate': ['get', 'heading'],
    'icon-rotation-alignment': 'map',
    'icon-size': 0.6,
    'icon-allow-overlap': true,
  },
  paint: {
    'icon-color': [
      'match', ['get', 'vessel_type'],
      'Container Ship', '#3B82F6',
      'Tanker',         '#EF4444',
      'Bulk Carrier',   '#EAB308',
      /* default */ '#FFFFFF'
    ]
  }
});
```

### 8.4 NewsAPI

**엔드포인트**: `https://newsapi.org/v2/everything`
**API Key 환경변수**: `NEWSAPI_KEY` (Node.js 프록시 서버 전용)

> ⚠️ **CORS 주의**: NewsAPI 무료 플랜은 브라우저 직접 호출 시 CORS 오류 발생.
> 반드시 Node.js 프록시 서버(`server/proxy.js`)의 `/api/news` 엔드포인트를 경유해야 함.

```javascript
// server/proxy.js — Express 라우트 추가
app.get('/api/news', async (req, res) => {
  const { from } = req.query;
  const params = new URLSearchParams({
    q: 'strait OR canal OR shipping OR sanctions OR port OR tanker OR blockade',
    language: 'en',
    sortBy: 'publishedAt',
    from,
    apiKey: process.env.NEWSAPI_KEY
  });
  const response = await fetch(`https://newsapi.org/v2/everything?${params}`);
  const data = await response.json();
  res.json(data.articles ?? []);
});

// agents/geopoliticalLinker.js — 프록시 경유 호출
async function fetchMaritimeNews(fromISO) {
  const proxyUrl = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';
  const response = await fetch(`${proxyUrl}/api/news?from=${encodeURIComponent(fromISO)}`);
  return response.json();
}
```

**환경변수 추가**: `NEWSAPI_KEY`는 Node.js `.env`에만 추가 (클라이언트 노출 금지).

---

## 9. UI/UX 요구사항

### 9.1 레이아웃 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Seabird — AI eyes on every ocean  [연결상태 인디케이터] │
├─────────────────────────────────────────────┬───────────────┤
│                                             │  Command Feed │
│                                             │  ┌──────────┐ │
│          Mapbox GL JS                       │  │ReportCard│ │
│          (전체 높이)                         │  │[CRITICAL]│ │
│                                             │  └──────────┘ │
│                                             │  ┌──────────┐ │
│                                             │  │ReportCard│ │
│                                             │  │[WARNING] │ │
│                                             │  └──────────┘ │
│                                             │    [필터 바]   │
│                                             ├───────────────┤
│                                             │ Commander 입력 │
└─────────────────────────────────────────────┴───────────────┘
```

**레이아웃 비율**: 지도 70% / Command Feed 30% (min-width: 320px)

### 9.2 컴포넌트 트리

```
src/
├── App.jsx                          # 루트 레이아웃, 전역 상태
├── components/
│   ├── MapView.jsx                  # Mapbox 지도 컨테이너
│   ├── ChokepointMarker.jsx         # 펄스 애니메이션 초크포인트 마커
│   ├── ShipDetailPanel.jsx          # 선박 클릭 시 사이드 패널 (좌측 하단 슬라이드업)
│   ├── CommandFeed.jsx              # 우측 피드 패널 (전체 높이)
│   │   ├── FeedFilter.jsx           # 에이전트/severity/시간 필터
│   │   └── ReportCard.jsx           # 개별 보고 카드
│   ├── ReportModal.jsx              # [상세보기] 클릭 시 모달
│   ├── CommanderInput.jsx           # 자연어 입력창 (피드 하단 고정)
│   └── StatusBar.jsx                # WebSocket 연결 상태, 선박 수 표시
├── agents/
│   ├── baseAgent.js
│   ├── portAnalyst.js
│   ├── chokepointWatcher.js
│   ├── cargoEstimator.js
│   ├── anomalyDetector.js
│   ├── geopoliticalLinker.js
│   └── orchestrator.js
├── hooks/
│   ├── useAISStream.js              # WebSocket 연결 + 버퍼링
│   ├── useAgentReports.js           # Supabase Realtime 구독
│   └── useBaseline.js              # 베이스라인 계산 유틸
├── data/
│   ├── tradePairs.js               # UN Comtrade 정적 데이터
│   ├── seasonalIndex.js            # 월별 계절 인덱스
│   └── hardcodedBaselines.js       # 초기 베이스라인 기본값
├── utils/
│   ├── claudeClient.js             # Claude API 호출 래퍼
│   ├── geoUtils.js                 # 좌표 계산 (거리, 바운딩박스 등)
│   └── aisParser.js                # AIS 메시지 파싱 유틸
└── types/
    └── agent.ts                    # TypeScript 타입 정의
```

### 9.3 상태 관리 구조

> Zustand 사용 (Redux 대비 보일러플레이트 최소화, 바이브코딩 친화)

```javascript
// store/useStore.js
import { create } from 'zustand';

const useStore = create((set, get) => ({
  // 지도 상태
  selectedShip: null,
  mapCenter: [127.0, 35.0],
  mapZoom: 4,
  setSelectedShip: (ship) => set({ selectedShip: ship }),
  focusMap: (lat, lng, zoom = 8) => set({ mapCenter: [lng, lat], mapZoom: zoom }),

  // 피드 상태
  reports: [],                 // agent_reports 실시간 배열
  feedFilters: {
    agents: ['PORT_ANALYST', 'CHOKEPOINT_WATCHER', 'CARGO_ESTIMATOR', 'ANOMALY_DETECTOR', 'GEOPOLITICAL_LINKER'],
    severities: ['INFO', 'WARNING', 'CRITICAL'],
    timeRange: '24h'           // '1h' | '6h' | '24h' | '7d'
  },
  addReport: (report) => set((state) => ({
    reports: [report, ...state.reports].slice(0, 100) // 최대 100건 유지
  })),
  setFeedFilter: (key, value) => set((state) => ({
    feedFilters: { ...state.feedFilters, [key]: value }
  })),

  // Commander 상태
  commanderInput: '',
  isCommanderLoading: false,
  setCommanderInput: (text) => set({ commanderInput: text }),
  setCommanderLoading: (v) => set({ isCommanderLoading: v }),

  // WebSocket 상태
  wsStatus: 'DISCONNECTED',   // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
  shipCount: 0,
  setWsStatus: (status) => set({ wsStatus: status }),
  setShipCount: (count) => set({ shipCount: count }),
}));
```

### 9.4 ReportCard UI 스펙

```jsx
// components/ReportCard.jsx
// props: { report: ReportCard }

const SEVERITY_CONFIG = {
  CRITICAL: { badge: '🔴 CRITICAL', bgColor: 'bg-red-900/30', borderColor: 'border-red-500' },
  WARNING:  { badge: '🟡 WARNING',  bgColor: 'bg-yellow-900/30', borderColor: 'border-yellow-500' },
  INFO:     { badge: '🟢 INFO',     bgColor: 'bg-green-900/30', borderColor: 'border-green-500' },
};

const AGENT_ICONS = {
  PORT_ANALYST:        '🏗️',
  CHOKEPOINT_WATCHER:  '🚢',
  CARGO_ESTIMATOR:     '📦',
  ANOMALY_DETECTOR:    '🔍',
  GEOPOLITICAL_LINKER: '🌐',
};

// 카드 레이아웃 (위에서 아래):
// [에이전트 아이콘 + 이름]  [severity 배지]  [보고 시각 KST]
// [요약 제목 (1줄, 볼드)]
// [data_points 수치 칩 2-3개: 현재값 vs 평균, 변화율 화살표]
// [버튼 행: [상세보기] [지도에서 →]]
```

### 9.5 다크 해양 테마 CSS 변수

```css
/* index.css */
:root {
  --color-bg-primary:    #0A0E1A;   /* 최심해 배경 */
  --color-bg-secondary:  #0F1629;   /* 패널 배경 */
  --color-bg-card:       #141E35;   /* 카드 배경 */
  --color-border:        #1E2D4A;   /* 기본 테두리 */
  --color-text-primary:  #E2E8F0;   /* 기본 텍스트 */
  --color-text-muted:    #64748B;   /* 보조 텍스트 */
  --color-accent-blue:   #3B82F6;   /* 컨테이너/링크 */
  --color-accent-red:    #EF4444;   /* 탱커/CRITICAL */
  --color-accent-yellow: #EAB308;   /* 벌크/WARNING */
  --color-accent-green:  #22C55E;   /* 긍정/INFO */
  --color-accent-teal:   #14B8A6;   /* 강조 포인트 */

  --font-mono: 'JetBrains Mono', 'Fira Code', monospace; /* 수치 표시용 */
}
```

---

## 10. 개발 일정 및 마일스톤

### Day 1 (월): 기반 인프라

| 태스크 | 예상 시간 | 파일 | 완료 기준 |
|--------|----------|------|-----------|
| Vite + React 프로젝트 셋업 | 30분 | `package.json`, `vite.config.js` | `npm run dev` 실행 |
| Supabase 프로젝트 생성 + 스키마 적용 | 1시간 | SQL 마이그레이션 | 4개 테이블 생성 확인 |
| Node.js 프록시 서버 + aisstream.io 연결 | 2시간 | `server/proxy.js` | WebSocket 연결 + console.log 메시지 수신 |
| Mapbox 기본 지도 렌더링 | 1시간 | `MapView.jsx` | 다크 해양 테마 지도 표시 |
| AIS → GeoJSON → Mapbox 파이프라인 | 3시간 | `useAISStream.js` | 100척+ 지도에 표시 |
| Supabase upsert 배치 처리 | 1시간 | `server/proxy.js` | 30초마다 DB 업데이트 확인 |

**Day 1 마일스톤**: 실시간 선박 1,000척+ 지도에 표시, Supabase 데이터 누적 시작

### Day 2 (화): Command Feed UI

| 태스크 | 예상 시간 | 파일 | 완료 기준 |
|--------|----------|------|-----------|
| Tailwind + 다크 해양 테마 설정 | 1시간 | `index.css`, `tailwind.config.js` | CSS 변수 적용 |
| CommandFeed 패널 레이아웃 | 2시간 | `CommandFeed.jsx` | 우측 30% 패널 고정 |
| ReportCard 컴포넌트 | 2시간 | `ReportCard.jsx` | severity 배지 + data_points 칩 |
| Supabase Realtime 구독 | 1시간 | `useAgentReports.js` | INSERT 시 피드 자동 업데이트 |
| FeedFilter (에이전트/severity) | 1시간 | `FeedFilter.jsx` | 필터 체크박스 동작 |
| ReportModal | 1시간 | `ReportModal.jsx` | [상세보기] 클릭 시 Markdown 렌더링 |

**Day 2 마일스톤**: 수동으로 Supabase에 INSERT 시 피드에 카드 자동 표시

### Day 3 (수): Agent 3 + Agent 2

| 태스크 | 예상 시간 | 파일 | 완료 기준 |
|--------|----------|------|-----------|
| baseAgent.js + claudeClient.js | 1시간 | `agents/baseAgent.js` | Claude API 호출 테스트 |
| tradePairs.js + seasonalIndex.js 데이터 입력 | 2시간 | `data/tradePairs.js` | 30개 교역 쌍 입력 |
| CARGO ESTIMATOR 구현 | 3시간 | `cargoEstimator.js` | 선박 클릭 → 8초 내 결과 |
| ShipDetailPanel UI | 1시간 | `ShipDetailPanel.jsx` | 화물 분포 + 근거 주석 표시 |
| CHOKEPOINT WATCHER 구현 | 2시간 | `chokepointWatcher.js` | 5분 폴링 + 트리거 테스트 |

**Day 3 마일스톤**: CARGO ESTIMATOR 데모 가능, CHOKEPOINT WATCHER 첫 자동 보고

### Day 4 (목): Agent 1 + Agent 4

| 태스크 | 예상 시간 | 파일 | 완료 기준 |
|--------|----------|------|-----------|
| PORT ANALYST 구현 | 3시간 | `portAnalyst.js` | 10분 폴링 + 항만별 보고 |
| ANOMALY DETECTOR 점수 계산 로직 | 3시간 | `anomalyDetector.js` | 2분 폴링 + 70점+ 탐지 |
| [지도에서 보기] 버튼 연동 | 1시간 | `ReportCard.jsx` + `useStore.js` | 클릭 시 지도 포커스 |
| ChokepointMarker 펄스 애니메이션 | 1시간 | `ChokepointMarker.jsx` | CRITICAL/WARNING 펄스 |

**Day 4 마일스톤**: 5개 중 4개 에이전트 자동 보고 작동

### Day 5 (금): Agent 5 + Orchestrator

| 태스크 | 예상 시간 | 파일 | 완료 기준 |
|--------|----------|------|-----------|
| NewsAPI 연동 + GEOPOLITICAL LINKER | 3시간 | `geopoliticalLinker.js` | 15분 폴링 + 뉴스-해운 연관 보고 |
| Orchestrator 구현 | 2시간 | `orchestrator.js` | 자연어 → 에이전트 라우팅 |
| CommanderInput UI | 1시간 | `CommanderInput.jsx` | Enter 입력 → 에이전트 실행 |
| 에이전트 간 연동 트리거 테스트 | 2시간 | 통합 테스트 | PORT ANALYST → CARGO ESTIMATOR 연동 |

**Day 5 마일스톤**: 5개 에이전트 모두 작동, Commander 입력 동작

### Day 6 (토): 비교 수치 + 완성도

| 태스크 | 예상 시간 | 파일 | 완료 기준 |
|--------|----------|------|-----------|
| 베이스라인 30분 스냅샷 저장 | 1시간 | `useBaseline.js` | 30분마다 baselines 테이블 INSERT |
| 90일 평균 계산 쿼리 | 1시간 | `useBaseline.js` | avg_90d 계산 함수 |
| DataPoint 컴포넌트 (화살표 + 색상) | 1시간 | `ReportCard.jsx` | ↑🔴 / ↓🟢 올바르게 표시 |
| 전체 UI 다듬기 (간격, 폰트, 반응형) | 2시간 | 각 컴포넌트 | 1280px 이상 레이아웃 깔끔 |
| Vercel 배포 | 1시간 | `vercel.json` | HTTPS URL 접속 가능 |
| Render 배포 (프록시 서버) | 1시간 | `render.yaml` | 프록시 서버 WebSocket 연결 |

**Day 6 마일스톤**: 외부 URL 배포 완료, 비교 수치 시스템 작동

### Day 7 (일): 버그픽스 + 데모 준비

| 태스크 | 예상 시간 |
|--------|----------|
| 크리티컬 버그 수정 | 2시간 |
| 데모 시나리오 스크립트 작성 | 1시간 |
| 데모 데이터 시드 (Supabase에 샘플 보고 카드 입력) | 1시간 |
| 발표 자료 (5분 분량) | 2시간 |

**데모 시나리오 (5분)**:
1. 지도 로드 → 10,000척 렌더링 (30초)
2. 수에즈 운하 클릭 → CHOKEPOINT WATCHER 최신 보고 확인 (1분)
3. 선박 클릭 → CARGO ESTIMATOR 즉시 실행 → 화물 분포 + 근거 주석 확인 (1분)
4. Commander 입력: "부산항 현재 상황" → PORT ANALYST 즉시 보고 (1분)
5. ANOMALY DETECTOR 보고 카드 클릭 → [지도에서 보기] → 이상 선박 포커스 (1분)

---

## 11. 오픈 이슈 및 리스크

### 11.1 기술 리스크

| 리스크 | 확률 | 영향도 | 대응 방안 |
|--------|------|--------|-----------|
| aisstream.io 무료 티어 메시지 수 제한 | 중 | 높음 | 백업: AIS Hub 무료 API, 지역 필터링으로 메시지 수 조절 |
| Claude API 레이트 리밋 (에이전트 동시 호출) | 중 | 중 | 에이전트 간 최소 500ms 지연 추가, 큐 시스템 구현 |
| Mapbox 10,000척 렌더링 성능 저하 | 낮 | 높음 | GeoJSON 대신 Mapbox GL Clustering 활용, 줌 레벨별 표시 조절 |
| NewsAPI 무료 티어: 하루 100건 제한 | 높음 | 낮음 | 15분 폴링을 30분으로 조정, 데모 시에만 활성화 |
| Render 무료 티어 콜드 스타트 (최대 1분 지연) | 높음 | 중 | 30분마다 헬스체크 핑으로 슬립 방지, Vercel Serverless 대안 고려 |

### 11.2 데이터 품질 이슈

| 이슈 | 설명 | 대응 |
|------|------|------|
| AIS 흘수 데이터 부정확 | 선박 스스로 신고, 미신고 많음 | CARGO ESTIMATOR에서 "흘수 데이터 부정확 시 DWT 70% 가정" 폴백 |
| 선종 코드 다양성 | AIS type 코드가 실제와 다른 경우 존재 | `vessel_type = 'Other'`로 처리, UI에서 "미분류"로 표시 |
| 베이스라인 부재 (초기 런칭) | Day 1~7 동안 90일 평균 데이터 없음 | 하드코딩된 업계 평균값으로 시작, "예비 베이스라인" 표시 |
| 목적지 항구명 비표준화 | "KRPUS", "BUSAN", "BUSAN KR" 등 혼재 | Fuzzy 매칭 유틸 (`geoUtils.normalizePortName()`) |

### 11.3 미결정 사항

| 항목 | 담당 | 기한 |
|------|------|------|
| aisstream.io API Key 발급 확인 | 개발자 | Day 1 오전 |
| NewsAPI Key 발급 확인 | 개발자 | Day 5 오전 |
| Supabase 프로젝트 지역 (Seoul ap-northeast-2) | 개발자 | Day 1 |
| Render vs Railway 선택 (Node.js 프록시 호스팅) | 개발자 | Day 1 |
| DWT 데이터 미포함 선박 처리 방침 | 설계 | Day 3 |

### 11.4 환경변수 체크리스트

```bash
# .env.local (Vite 프론트엔드)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MAPBOX_TOKEN=
VITE_ANTHROPIC_API_KEY=   # 해커톤 한정. 프로덕션에서는 반드시 서버 사이드로 이동
VITE_PROXY_URL=           # 로컬: http://localhost:3001 / 배포: https://your-render-url.onrender.com

# .env (Node.js 프록시 서버)
AISSTREAM_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=  # 프록시는 service role key 사용
NEWSAPI_KEY=                # 클라이언트에 노출하지 말 것 (CORS 우회 목적)
PORT=3001
```

> ⚠️ **보안 주의**: `VITE_ANTHROPIC_API_KEY`가 클라이언트에 노출됨. 해커톤 기간 데모 목적이므로 허용하되, 프로덕션에서는 반드시 서버 사이드로 이동할 것. Claude API 호출 분량 모니터링 필수.
> `VITE_NEWSAPI_KEY` 제거됨 — NewsAPI는 서버 사이드(`NEWSAPI_KEY`)로만 사용.

---

## 부록: 빠른 구현 레퍼런스

### aisstream.io 구독 메시지 전체 예시

```json
{
  "APIKey": "YOUR_KEY",
  "MessageTypes": ["PositionReport", "ShipStaticData"],
  "BoundingBoxes": [[[-180, -90], [180, 90]]]
}
```

### Supabase Realtime 구독 코드

```javascript
// hooks/useAgentReports.js
import { useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import useStore from '../store/useStore';

export function useAgentReports() {
  const addReport = useStore(s => s.addReport);

  useEffect(() => {
    const channel = supabase
      .channel('agent-reports')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_reports' },
        (payload) => addReport(payload.new)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);
}
```

### 거리 계산 유틸 (nm 단위)

```javascript
// utils/geoUtils.js
export function distanceNm(lat1, lng1, lat2, lng2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
          + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180)
          * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function nmToDeg(nm) {
  return nm / 60; // 1도 = 60nm 근사
}
```

---

*Seabird PRD v1.0 — 해커톤 7일 바이브코딩 전용 문서 | AI eyes on every ocean*
*각 섹션은 AI 코딩 도구(Cursor/Claude Code)에 직접 붙여넣어 구현 지시로 활용 가능*
