import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import useStore from '../store/useStore.js';
import { parseUtc } from '../utils/time.js';
import { supabase } from '../utils/supabaseClient.js';
import { normalizeDestination } from '../utils/destinationNormalizer.js';

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001';

// 편차 보드 막대 색 — 악화 방향(빨강)·여유 방향(파랑)
function boardBarColor(pct, higherIsBad) {
  const bad = higherIsBad ? pct : -pct; // 큰 양수 = 악화
  if (bad > 50) return '#EF4444';
  if (bad > 20) return '#EAB308';
  if (bad < -20) return '#3B82F6';
  return '#64748B';
}

function BoardTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-sea-panel border border-sea-border rounded-lg px-3 py-2 text-[11px] font-mono">
      <p className="text-white font-bold mb-1">{d.name}</p>
      <p className="text-white/60">현재 {d.current} · 평년 {d.baseline}</p>
      <p className="text-white/60">
        편차 {d.pct > 0 ? '+' : ''}{d.pct}%{d.z != null ? ` · ${d.z > 0 ? '+' : ''}${d.z}σ` : ''}
      </p>
    </div>
  );
}

// destination 자유텍스트 → 정규화 표시 라벨 (없으면 null → 집계 제외)
function destLabel(raw) {
  const r = normalizeDestination(raw);
  if (r.category === 'other' || r.category === 'none') return null;
  return r.port || (r.countryKo ? `${r.countryKo} (기타항)` : null);
}

// 선종 색상 (MapFilter와 동일)
const VESSEL_COLORS = {
  'Container Ship': '#3B82F6',
  'Tanker':         '#EF4444',
  'Bulk Carrier':   '#F59E0B',
  'LNG Carrier':    '#8B5CF6',
  'Passenger':      '#EC4899',
  'Fishing':        '#22C55E',
  'Special Craft':  '#06B6D4',
  'Other':          '#6B7280',
};

// 국기 이모지 (상위 기국)
const FLAG_EMOJI = {
  PAN: '🇵🇦', LIB: '🇱🇷', MHL: '🇲🇭', BHS: '🇧🇸', SGP: '🇸🇬',
  MLT: '🇲🇹', CYP: '🇨🇾', CHN: '🇨🇳', GRC: '🇬🇷', NOR: '🇳🇴',
  KOR: '🇰🇷', JPN: '🇯🇵', USA: '🇺🇸', GBR: '🇬🇧', TKM: '🏴',
  HKG: '🇭🇰', TWN: '🇹🇼', IND: '🇮🇳', TUR: '🇹🇷', RUS: '🇷🇺',
};

const CP_NAME = {
  suez: '수에즈', malacca: '말라카', hormuz: '호르무즈',
  panama: '파나마', dover: '영불해협', korea_strait: '대한해협', bab_el_mandeb: '바브만데브',
};

const SPEED_BUCKETS = [
  { label: '정박(0-2)', min: 0, max: 2 },
  { label: '저속(2-8)', min: 2, max: 8 },
  { label: '항행(8-14)', min: 8, max: 14 },
  { label: '쾌속(14-20)', min: 14, max: 20 },
  { label: '고속(20+)', min: 20, max: Infinity },
];

const NAV_STATUS_LABEL = {
  0: '항행 중',
  1: '정박',
  5: '계류',
  8: '범선',
  15: '미정의',
};

// 툴팁 공통 스타일
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-sea-card border border-sea-border rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      {label && <div className="text-white/60 mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? p.fill }} className="flex gap-2">
          <span>{p.name}:</span>
          <span className="text-white">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-sea-card border border-sea-border rounded-xl p-4 ${className}`}>
      <h3 className="text-xs font-mono text-sea-muted uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-sea-card border border-sea-border rounded-xl px-4 py-3 flex flex-col gap-1">
      <span className="text-[10px] font-mono text-sea-muted uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-mono font-bold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-sea-muted truncate">{sub}</span>}
    </div>
  );
}

export default function StatsDashboard() {
  const { showStatsDashboard, toggleStatsDashboard, shipCount, reports } = useStore();

  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDest, setSelectedDest] = useState(null);
  const [boardMetric, setBoardMetric] = useState('daily_throughput'); // 초크포인트 기본 (이력 깔끔)
  const [board, setBoard] = useState([]);

  // 대시보드 열릴 때 Supabase에서 선박 목록 조회
  const fetchShips = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ships')
      .select('mmsi, vessel_type, speed, flag_country, nav_status, destination')
      .not('lat', 'is', null)
      .limit(5000);
    setShips(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (showStatsDashboard) {
      fetchShips();
      setSelectedDest(null);
    }
  }, [showStatsDashboard, fetchShips]);

  // 평년 대비 편차 보드 — metric 토글 시 재조회
  useEffect(() => {
    if (!showStatsDashboard) return;
    fetch(`${PROXY_URL}/api/comparison-board?metric=${boardMetric}`)
      .then(r => r.json())
      .then(d => setBoard(d.rows ?? []))
      .catch(() => setBoard([]));
  }, [showStatsDashboard, boardMetric]);

  const boardData = useMemo(
    () => board.map(r => ({ ...r, pctClamped: Math.max(-150, Math.min(150, r.pct)) })),
    [board],
  );

  // ESC로 닫기
  useEffect(() => {
    if (!showStatsDashboard) return;
    const handler = (e) => { if (e.key === 'Escape') toggleStatsDashboard(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showStatsDashboard, toggleStatsDashboard]);

  // ── 집계 계산 ──────────────────────────────────────────────────

  const vesselTypeDist = useMemo(() => {
    const counts = {};
    ships.forEach(s => {
      const t = s.vessel_type ?? 'Other';
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [ships]);

  const flagTop10 = useMemo(() => {
    const counts = {};
    ships.forEach(s => {
      if (!s.flag_country) return;
      counts[s.flag_country] = (counts[s.flag_country] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ name: `${FLAG_EMOJI[code] ?? '🏴'} ${code}`, count }));
  }, [ships]);

  const speedDist = useMemo(() => {
    const buckets = SPEED_BUCKETS.map(b => ({ ...b, count: 0 }));
    ships.forEach(s => {
      const spd = s.speed ?? 0;
      const bucket = buckets.find(b => spd >= b.min && spd < b.max);
      if (bucket) bucket.count++;
    });
    return buckets.map(b => ({ name: b.label, count: b.count }));
  }, [ships]);

  const navStatusDist = useMemo(() => {
    const counts = {};
    ships.forEach(s => {
      const key = s.nav_status != null ? String(s.nav_status) : 'null';
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, value]) => ({
        name: NAV_STATUS_LABEL[Number(code)] ?? `상태 ${code}`,
        value,
      }));
  }, [ships]);

  // 초크포인트: CHOKEPOINT_WATCHER 최신 보고에서 data_points 추출
  const chokepointData = useMemo(() => {
    const latest = {};
    reports.forEach(r => {
      if (r.agent_id !== 'CHOKEPOINT_WATCHER') return;
      const cpId = r.raw_data?.cp_id;
      if (!cpId || latest[cpId]) return;
      latest[cpId] = r;
    });
    return Object.values(latest).map(r => {
      const dp = r.data_points ?? [];
      const currentDp = dp.find(d => d.label?.includes('현재') || d.label?.includes('통과'));
      const baselineDp = dp.find(d => d.label?.includes('기준') || d.label?.includes('baseline'));
      return {
        name: CP_NAME[r.raw_data.cp_id] ?? r.raw_data.cp_id,
        current: currentDp?.current ?? r.raw_data?.ships ?? 0,
        baseline: baselineDp?.current ?? r.raw_data?.baseline ?? 0,
        severity: r.severity,
      };
    });
  }, [reports]);

  // 항만: PORT_ANALYST 최신 보고에서 data_points 추출 (대기 선박)
  const portData = useMemo(() => {
    const portReports = reports.filter(r => r.agent_id === 'PORT_ANALYST');
    const seen = new Set();
    const result = [];
    portReports.forEach(r => {
      const dp = r.data_points ?? [];
      dp.forEach(d => {
        if (seen.has(d.label) || !d.current) return;
        if (d.label?.includes('대기') || d.label?.includes('waiting') || d.unit === '척') {
          seen.add(d.label);
          result.push({
            name: d.label.replace(/대기|waiting|\s*선박/gi, '').trim() || r.title,
            waiting: d.current,
            baseline: d.baseline ?? 0,
            change: d.change_pct ?? 0,
          });
        }
      });
    });
    return result.sort((a, b) => b.waiting - a.waiting).slice(0, 10);
  }, [reports]);

  // 에이전트 경보 타임라인 (24시간, 1시간 단위)
  const alertTimeline = useMemo(() => {
    const now = Date.now();
    const hours = Array.from({ length: 24 }, (_, i) => {
      const h = new Date(now - (23 - i) * 3600000);
      // 한국 시간(KST) 기준 시각 라벨
      const kstHour = parseInt(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(h), 10,
      ) % 24;
      return {
        label: `${kstHour}시`,
        CRITICAL: 0,
        WARNING: 0,
        INFO: 0,
      };
    });
    reports.forEach(r => {
      const age = now - parseUtc(r.created_at).getTime();
      const hoursAgo = Math.floor(age / 3600000);
      if (hoursAgo < 0 || hoursAgo > 23) return;
      const idx = 23 - hoursAgo;
      if (hours[idx] && r.severity in hours[idx]) {
        hours[idx][r.severity]++;
      }
    });
    return hours;
  }, [reports]);

  // 목적지 Top 15 (정규화 라벨로 파편화 통합)
  const destTop15 = useMemo(() => {
    const counts = {};
    ships.forEach(s => {
      const label = destLabel(s.destination);
      if (!label) return;
      counts[label] = (counts[label] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([dest, count]) => ({ dest, count }));
  }, [ships]);

  // 목적지 국가 Top 10
  const destCountryTop = useMemo(() => {
    const counts = {};
    ships.forEach(s => {
      const r = normalizeDestination(s.destination);
      if (!r.countryKo) return;
      counts[r.countryKo] = (counts[r.countryKo] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [ships]);

  // 선택 목적지의 선종 분포 (정규화 라벨 일치 기준)
  const destVesselDist = useMemo(() => {
    if (!selectedDest) return [];
    const counts = {};
    ships.forEach(s => {
      if (destLabel(s.destination) !== selectedDest) return;
      const t = s.vessel_type ?? 'Other';
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [ships, selectedDest]);

  // KPI 계산
  const todayCritical = useMemo(() => {
    const today = new Date().toDateString();
    return reports.filter(r => r.severity === 'CRITICAL' && parseUtc(r.created_at).toDateString() === today).length;
  }, [reports]);

  const busiestPort = useMemo(() => {
    if (!portData.length) return null;
    return portData[0];
  }, [portData]);

  const dangerCp = useMemo(() => {
    return chokepointData.find(c => c.severity === 'CRITICAL') ?? chokepointData.find(c => c.severity === 'WARNING');
  }, [chokepointData]);

  if (!showStatsDashboard) return null;

  return (
    <div className="fixed inset-0 z-50 bg-sea-bg/97 backdrop-blur-sm overflow-y-auto">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-sea-panel border-b border-sea-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold tracking-widest text-white">📊 해양 통계 대시보드</span>
          {loading && (
            <span className="text-[10px] font-mono text-sea-muted animate-pulse">데이터 로드 중...</span>
          )}
          {!loading && (
            <span className="text-[10px] font-mono text-sea-muted">{ships.length.toLocaleString()}척 기준</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchShips}
            className="text-[10px] font-mono text-sea-muted hover:text-white px-2 py-1 rounded border border-sea-border hover:border-white/30 transition-colors"
          >
            새로고침
          </button>
          <button
            onClick={toggleStatsDashboard}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-sea-border hover:bg-white/10 text-sea-muted hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5">
        {/* KPI 카드 4개 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="추적 선박"
            value={shipCount.toLocaleString()}
            sub="실시간 AIS 수신"
            color="text-blue-400"
          />
          <KpiCard
            label="오늘 CRITICAL 경보"
            value={todayCritical}
            sub="오늘 발생 긴급 보고"
            color={todayCritical > 0 ? 'text-red-400' : 'text-green-400'}
          />
          <KpiCard
            label="최고 혼잡 항만"
            value={busiestPort ? `${busiestPort.waiting}척` : '—'}
            sub={busiestPort ? `${busiestPort.name} (기준: ${busiestPort.baseline}척)` : '데이터 없음'}
            color="text-yellow-400"
          />
          <KpiCard
            label="위험 초크포인트"
            value={dangerCp ? dangerCp.name : '정상'}
            sub={dangerCp ? `${dangerCp.severity} — ${dangerCp.current}척 통과` : '모든 초크포인트 정상'}
            color={dangerCp?.severity === 'CRITICAL' ? 'text-red-400' : dangerCp ? 'text-yellow-400' : 'text-green-400'}
          />
        </div>

        {/* 그리드 1행: 선종 분포 + 기국 Top 10 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="선종 분포">
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={vesselTypeDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {vesselTypeDist.map((entry) => (
                      <Cell key={entry.name} fill={VESSEL_COLORS[entry.name] ?? '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 text-xs font-mono">
                {vesselTypeDist.map(item => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: VESSEL_COLORS[item.name] ?? '#6B7280' }}
                    />
                    <span className="text-white/70 truncate flex-1">{item.name}</span>
                    <span className="text-white tabular-nums">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="기국 Top 10">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={flagTop10} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} width={72} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name="선박 수" fill="#3B82F6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* 그리드 2행: 속력 분포 + 항행 상태 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="속력 분포 (노트)">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={speedDist} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name="선박 수" fill="#22C55E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="항행 상태 분포">
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={navStatusDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {navStatusDist.map((_, i) => (
                      <Cell
                        key={i}
                        fill={['#3B82F6', '#F59E0B', '#EF4444', '#22C55E', '#6B7280'][i % 5]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 text-xs font-mono">
                {navStatusDist.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: ['#3B82F6', '#F59E0B', '#EF4444', '#22C55E', '#6B7280'][i % 5] }}
                    />
                    <span className="text-white/70 flex-1">{item.name}</span>
                    <span className="text-white tabular-nums">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 초크포인트 통과량 vs 기준값 */}
        {chokepointData.length > 0 && (
          <SectionCard title="초크포인트 통과량 vs 기준값 (척/일)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chokepointData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="baseline" name="기준값" fill="#1E2D4A" radius={[2, 2, 0, 0]} />
                <Bar dataKey="current" name="현재" radius={[2, 2, 0, 0]}>
                  {chokepointData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.severity === 'CRITICAL' ? '#EF4444' : entry.severity === 'WARNING' ? '#EAB308' : '#22C55E'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* 항만 혼잡도 Top 10 */}
        {portData.length > 0 && (
          <SectionCard title="항만 혼잡도 Top 10 (대기 선박 수)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={portData} layout="vertical" margin={{ left: 16, right: 48, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} width={80} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="waiting" name="대기 선박" radius={[0, 3, 3, 0]}>
                  {portData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.change > 40 ? '#EF4444' : entry.change > 15 ? '#EAB308' : '#3B82F6'}
                    />
                  ))}
                </Bar>
                <ReferenceLine x={0} stroke="#1E2D4A" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* 평년 대비 편차 보드 — 지역 간 비교 */}
        <SectionCard title="평년 대비 편차 보드">
          <div className="flex gap-1.5 mb-3">
            {[['daily_throughput', '초크포인트'], ['waiting_ships', '항만']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setBoardMetric(m)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors ${
                  boardMetric === m
                    ? 'border-blue-500 bg-blue-500/15 text-white'
                    : 'border-sea-border text-sea-muted hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {boardData.length === 0 ? (
            <p className="text-[11px] text-sea-muted font-mono py-10 text-center">이력 데이터 누적 중…</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, boardData.length * 30)}>
              <BarChart data={boardData} layout="vertical" margin={{ left: 16, right: 24, top: 0, bottom: 0 }}>
                <XAxis
                  type="number" domain={[-150, 150]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false}
                />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} width={84} axisLine={false} tickLine={false} />
                <Tooltip content={<BoardTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <ReferenceLine x={0} stroke="#334155" />
                <Bar dataKey="pctClamped" name="편차" radius={[0, 3, 3, 0]}>
                  {boardData.map((entry, i) => (
                    <Cell key={i} fill={boardBarColor(entry.pct, boardMetric === 'waiting_ships')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-[8px] text-white/25 font-mono mt-1">
            평년 대비 편차(%). 빨강=악화(혼잡↑·통항↓) · 파랑=여유. 막대는 ±150%에서 잘림(실값은 hover).
          </p>
        </SectionCard>

        {/* 에이전트 경보 타임라인 */}
        <SectionCard title="에이전트 경보 타임라인 (최근 24시간)">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={alertTimeline} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="CRITICAL" name="CRITICAL" stackId="a" fill="#EF4444" />
              <Bar dataKey="WARNING" name="WARNING" stackId="a" fill="#EAB308" />
              <Bar dataKey="INFO" name="INFO" stackId="a" fill="#22C55E" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* 목적지별 선박 수 + 선종 드릴다운 */}
        <SectionCard title={selectedDest ? `📍 ${selectedDest}으로 향하는 선박 — 선종별` : '목적지 Top 15'}>
          {selectedDest ? (
            <div>
              <button
                onClick={() => setSelectedDest(null)}
                className="mb-3 text-[10px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                ← 전체 목적지로 돌아가기
              </button>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="45%" height={180}>
                  <PieChart>
                    <Pie
                      data={destVesselDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {destVesselDist.map((entry) => (
                        <Cell key={entry.name} fill={VESSEL_COLORS[entry.name] ?? '#6B7280'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 text-xs font-mono">
                  {destVesselDist.map(item => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: VESSEL_COLORS[item.name] ?? '#6B7280' }}
                      />
                      <span className="text-white/70 flex-1">{item.name}</span>
                      <span className="text-white tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-mono text-sea-muted mb-2">막대를 클릭하면 선종별 상세를 볼 수 있습니다</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={destTop15}
                  layout="vertical"
                  margin={{ left: 8, right: 40, top: 0, bottom: 0 }}
                  onClick={(e) => e?.activePayload?.[0] && setSelectedDest(e.activePayload[0].payload.dest)}
                >
                  <XAxis type="number" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="dest"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    width={100}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
                  <Bar
                    dataKey="count"
                    name="선박 수"
                    fill="#8B5CF6"
                    radius={[0, 3, 3, 0]}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* 목적지 국가 Top 10 (destination 정규화) */}
        {destCountryTop.length > 0 && (
          <SectionCard title="목적지 국가 Top 10">
            <p className="text-[10px] font-mono text-sea-muted mb-2">AIS destination 자유텍스트를 정규화해 집계 (LOCODE·항구명 → 국가)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={destCountryTop} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
                <Bar dataKey="count" name="선박 수" fill="#10B981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
