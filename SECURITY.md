# Seabird — 보안 체크리스트 (해외 공개 런칭 전)

데모(아는 사람만 접속)와 달리, 공개 런칭하면 **불특정 다수가 서버·DB·외부 토큰을 직접 때릴 수 있다.**
이 문서는 ① 이미 코드로 적용된 방어와 ② 대시보드에서 직접 해야 하는 작업을 정리한다.

---

## ✅ 코드로 적용 완료 (server/index.js)

| 항목 | 내용 | 관련 env |
|------|------|----------|
| **CORS allowlist** | `ALLOWED_ORIGINS`에 적힌 오리진의 브라우저 요청만 허용. 미설정 시 전체 허용(로컬). | `ALLOWED_ORIGINS` |
| **전역 rate limit** | 모든 `/api` IP당 분당 120요청 | `RATE_LIMIT_API` (기본 120) |
| **유료 API rate limit** | `cargo-estimate`·`orchestrate`·`region-news`·`news`(Claude/Perplexity 호출)를 IP당 **합산** 분당 10요청 | `RATE_LIMIT_PAID` (기본 10) |
| **입력 길이 제한** | `/api/orchestrate`의 자유 텍스트 500자 제한(프롬프트 인젝션·비용 어뷰징 완화) | — |
| **body 크기 제한** | `express.json({ limit: '64kb' })` | — |
| **WS 연결 상한** | relay 전체 동시 연결 300 + IP당 6(egress 폭증 차단) | `MAX_RELAY_CLIENTS`, `MAX_RELAY_PER_IP` |
| **trust proxy** | Render 프록시 1홉 뒤 실 IP 인식(rate limit 정확도) | — |
| **죽은 키 코드 제거** | 브라우저에서 Anthropic 키를 쓰던 `src/utils/claudeClient.js` 삭제, example에서 `VITE_ANTHROPIC_API_KEY` 제거 | — |

> ⚠️ CORS는 **브라우저 교차 출처만** 막는다. `curl`/스크립트 직접 호출은 못 막으므로 **rate limit이 실제 비용 방어선**이다.

### 배포 시 반드시 설정할 Render 환경변수
```env
ALLOWED_ORIGINS=https://seabird-tau.vercel.app   # 실제 프론트 도메인(콤마로 여러 개)
RATE_LIMIT_API=120
RATE_LIMIT_PAID=10
MAX_RELAY_CLIENTS=300
MAX_RELAY_PER_IP=6
```
> `ALLOWED_ORIGINS`를 비워두면 전체 허용이 되어 보호가 약해진다. **프로덕션에선 반드시 채울 것.**

---

## 🔲 대시보드에서 직접 해야 하는 작업 (코드로 불가)

### 1. Supabase RLS 검증 (가장 중요)

anon 키는 프론트에 공개되므로, **RLS가 약하면 누구나 `ships`·`agent_reports`를 위·변조/삭제**할 수 있다.
Supabase SQL Editor에서 아래로 현재 정책을 점검한다.

```sql
-- (a) 각 테이블 RLS 활성화 여부 — 전부 rowsecurity = true 여야 함
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- (b) anon/public 역할에 INSERT·UPDATE·DELETE 정책이 있는지 (있으면 위험)
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

**원하는 상태:**
- 모든 테이블 `rowsecurity = true`.
- anon(public)에는 **꼭 필요한 테이블의 `SELECT` 정책만** 존재해야 함:
  - `agent_reports` — anon `SELECT` 허용(피드 표시·Realtime).
  - `ships` — anon `SELECT` 허용(지도. ※ 단 쓰기는 service_role만).
  - `freight_history`·`baselines` 등 — 프론트가 직접 읽으면 `SELECT`만, 아니면 정책 없음.
- anon에 `INSERT/UPDATE/DELETE` 정책이 있으면 **삭제**한다. 모든 쓰기는 서버(service_role)만.
- `ship_positions`는 의도적으로 anon 차단(서버 `/api/ship-track` 경유) — 그대로 둔다.

anon 쓰기 정책을 없애는 예:
```sql
-- 예시: 실수로 만들어진 anon 쓰기 정책 제거 (policyname은 위 (b) 결과로 확인)
DROP POLICY IF EXISTS "<anon write 정책 이름>" ON public.ships;
DROP POLICY IF EXISTS "<anon write 정책 이름>" ON public.agent_reports;
-- RLS가 꺼진 테이블이 있으면 켜기
ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reports ENABLE ROW LEVEL SECURITY;
```
> RLS가 켜져 있고 anon 쓰기 정책이 없으면, anon 키로는 읽기만 되고 쓰기는 전부 거부된다(서버 service_role은 RLS 우회).

### 2. Mapbox 토큰 도메인 제한

`VITE_MAPBOX_TOKEN`은 공개 번들에 노출되는 게 정상이지만, **URL 제한이 없으면 남이 당신 토큰으로 자기 사이트 지도를 띄워 쿼터를 소진**한다.

- Mapbox 계정 → **Access tokens** → 해당 public 토큰 편집
- **URL restrictions**에 실제 도메인 추가: `seabird-tau.vercel.app`, (커스텀 도메인 사용 시 추가)
- 토큰 scope는 `styles:read`, `fonts:read` 등 **읽기 전용**만 남기고 불필요한 scope 제거.

### 3. 외부 API 사용량 알림 설정 (비용 안전망)

rate limit을 넣었어도, 예상치 못한 트래픽 대비 **결제 경보**를 건다.
- **Anthropic Console** → 사용량/결제 한도(spend limit) 설정.
- **Perplexity** → 사용량 알림.
- **Render** → 대역폭(egress)·컴퓨트 사용량 알림.
- **Supabase** → 프로젝트 사용량 알림(무료 티어 한도 근접 시).

---

## ⚖️ 법적 / 약관 (해외 공개 서비스라 확인 권장)

| 데이터 | 확인 사항 |
|--------|-----------|
| aisstream.io (무료 티어) | AIS 데이터를 **제3자에게 공개 재배포**하는 게 약관상 허용되는지. 상업/공개 서비스면 유료 플랜·재배포 권한 필요할 수 있음. |
| KOBC 스크래핑 | gridList.do HTML 스크래핑의 이용약관·robots 준수 여부. |
| data.go.kr (해양수산부) | 공공데이터 **상업적 공개 서비스** 활용 범위·출처 표기 의무. |
| GICOMS | 발급 시 등록 도메인(seabird.onrender.com) 외 사용 제한. |

> AIS 선박 위치 자체는 공개 신호지만 **재배포 조건**은 제공자마다 다르다. 공개 런칭 전 각 약관을 한 번 훑을 것.

---

## 권장 적용 순서
1. **Render 환경변수 설정**(`ALLOWED_ORIGINS` 등) + 재배포 — 코드 방어 활성화.
2. **Supabase RLS 검증/수정** — 데이터 위변조 차단(가장 치명적).
3. **Mapbox 도메인 제한** + **API 결제 경보** — 비용 안전망.
4. **데이터 약관 확인** — 법적 리스크 정리.

---
*적용일 기준 코드 방어는 `server/index.js`에 반영됨. 대시보드 항목(2·3·4)은 외부 콘솔 작업이라 별도 수행 필요.*
