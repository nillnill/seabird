import { useEffect, useState } from 'react';
import useStore from '../store/useStore.js';
import { runCargoEstimator } from '../agents/cargoEstimator.js';
import { supabase } from '../utils/supabaseClient.js';
import { SHIP_CHARACTERS } from '../data/shipCharacters.js';

const ALPHA3_TO_ALPHA2 = {
  USA:'US', GBR:'GB', DEU:'DE', DNK:'DK', ESP:'ES', FRA:'FR', ITA:'IT', NLD:'NL',
  HKG:'HK', KOR:'KR', CHN:'CN', JPN:'JP', IDN:'ID', SGP:'SG', VNM:'VN', PHL:'PH',
  IND:'IN', ARE:'AE', SAU:'SA', AUS:'AU', NZL:'NZ', LBR:'LR', SLE:'SL', MDG:'MG',
  TZA:'TZ', PRT:'PT', CYP:'CY', MLT:'MT', CHE:'CH', RUS:'RU', EST:'EE', LVA:'LV',
  LTU:'LT', NOR:'NO', SWE:'SE', FIN:'FI', GRC:'GR', TUR:'TR', MYS:'MY', TWN:'TW',
  BGD:'BD', PAK:'PK', IRN:'IR', IRQ:'IQ', KWT:'KW', QAT:'QA', BHR:'BH', OMN:'OM',
  EGY:'EG', MAR:'MA', DZA:'DZ', ZAF:'ZA', NGA:'NG', KEN:'KE', BRA:'BR', MEX:'MX',
  ARG:'AR', CHL:'CL', COL:'CO', PAN:'PA', CAN:'CA', BEL:'BE', POL:'PL', ROU:'RO',
  UKR:'UA', CYM:'KY', BHS:'BS', VCT:'VC', ATG:'AG', BRB:'BB',
};

const ALPHA3_KO = {
  KOR:'한국', CHN:'중국', JPN:'일본', USA:'미국', GBR:'영국', DEU:'독일',
  DNK:'덴마크', ESP:'스페인', FRA:'프랑스', ITA:'이탈리아', NLD:'네덜란드',
  HKG:'홍콩', IDN:'인도네시아', SGP:'싱가포르', VNM:'베트남', PHL:'필리핀',
  IND:'인도', ARE:'아랍에미리트', SAU:'사우디아라비아', AUS:'호주', NZL:'뉴질랜드',
  LBR:'라이베리아', SLE:'시에라리온', MDG:'마다가스카르', TZA:'탄자니아',
  PRT:'포르투갈', CYP:'키프로스', MLT:'몰타', CHE:'스위스', RUS:'러시아',
  EST:'에스토니아', LVA:'라트비아', LTU:'리투아니아', NOR:'노르웨이',
  SWE:'스웨덴', FIN:'핀란드', GRC:'그리스', TUR:'튀르키예', MYS:'말레이시아',
  TWN:'대만', BGD:'방글라데시', PAK:'파키스탄', IRN:'이란', IRQ:'이라크',
  KWT:'쿠웨이트', QAT:'카타르', BHR:'바레인', OMN:'오만', EGY:'이집트',
  MAR:'모로코', DZA:'알제리', ZAF:'남아프리카', NGA:'나이지리아', KEN:'케냐',
  BRA:'브라질', MEX:'멕시코', ARG:'아르헨티나', CHL:'칠레', COL:'콜롬비아',
  PAN:'파나마', CAN:'캐나다', BEL:'벨기에', POL:'폴란드', ROU:'루마니아',
  UKR:'우크라이나', CYM:'케이맨 제도', BHS:'바하마',
};

function toFlagEmoji(alpha3) {
  if (!alpha3) return null;
  const a2 = ALPHA3_TO_ALPHA2[alpha3.toUpperCase()];
  if (!a2) return null;
  return Array.from(a2).map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

const VESSEL_TYPE_KO = {
  'Container Ship': '컨테이너선',
  'Tanker':         '탱커',
  'Bulk Carrier':   '벌크선',
  'LNG Carrier':    'LNG선',
  'Passenger':      '여객선',
  'Fishing':        '어선',
  'Special Craft':  '특수선',
  'Other':          '기타',
};

const NAV_STATUS_KO = {
  0:  { label: '항행 중',       color: '#22C55E' },
  1:  { label: '정박 중',       color: '#60A5FA' },
  2:  { label: '조종 불능',     color: '#FBBF24' },
  3:  { label: '조종 제한',     color: '#FBBF24' },
  4:  { label: '흘수 제한',     color: '#FBBF24' },
  5:  { label: '계류 중',       color: '#60A5FA' },
  6:  { label: '좌초',          color: '#EF4444' },
  7:  { label: '어로 중',       color: '#14B8A6' },
  8:  { label: '항행 중(범선)', color: '#22C55E' },
  14: { label: 'AIS-SART',     color: '#EF4444' },
};

function formatEta(eta) {
  if (!eta) return null;
  try {
    if (typeof eta === 'object' && eta.Month) {
      const { Month: mo, Day: d, Hour: h, Minute: mi } = eta;
      if (mo === 0 && d === 0) return null;
      return `${String(mo).padStart(2,'0')}/${String(d).padStart(2,'0')} ${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
    }
    const date = new Date(eta);
    if (isNaN(date.getTime())) return null;
    return `${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  } catch { return null; }
}

const ALPHA2_KO = {
  KR:'한국', CN:'중국', JP:'일본', SG:'싱가포르', HK:'홍콩', TW:'대만',
  US:'미국', CA:'캐나다', MX:'멕시코', PA:'파나마', BR:'브라질', AR:'아르헨티나', CL:'칠레',
  GB:'영국', DE:'독일', NL:'네덜란드', BE:'벨기에', FR:'프랑스', IT:'이탈리아',
  ES:'스페인', PT:'포르투갈', NO:'노르웨이', SE:'스웨덴', DK:'덴마크', FI:'핀란드',
  PL:'폴란드', RO:'루마니아', GR:'그리스', TR:'튀르키예', CY:'키프로스', MT:'몰타',
  RU:'러시아', UA:'우크라이나', EE:'에스토니아', LV:'라트비아', LT:'리투아니아',
  AE:'아랍에미리트', SA:'사우디아라비아', QA:'카타르', KW:'쿠웨이트', BH:'바레인', OM:'오만',
  IR:'이란', IQ:'이라크', EG:'이집트', MA:'모로코', ZA:'남아프리카', NG:'나이지리아',
  AU:'호주', NZ:'뉴질랜드', IN:'인도', LK:'스리랑카', PK:'파키스탄', BD:'방글라데시',
  MY:'말레이시아', ID:'인도네시아', TH:'태국', VN:'베트남', PH:'필리핀',
};

const LOCODE_CITY_KO = {
  KRPUS:'부산', KRINC:'인천', KRKWA:'광양', KRUSE:'울산', KRMOK:'목포',
  KRPTK:'평택', KRTYN:'대산', KRYOS:'여수', KRPOH:'포항',
  CNSHA:'상하이', CNTAO:'칭다오', CNSZX:'선전', CNCAN:'광저우', CNXMN:'샤먼',
  CNNBO:'닝보', CNTJN:'톈진', CNDLC:'다롄', CNGZU:'광저우', CNNTG:'난통',
  CNQIN:'칭다오', CNZJG:'장자강', CNHGH:'항저우',
  JPYOK:'요코하마', JPKOB:'고베', JPOSA:'오사카', JPNGO:'나고야',
  JPTYO:'도쿄', JPKIJ:'니가타', JPKSM:'카시마',
  SGSIN:'싱가포르',
  HKHKG:'홍콩',
  TWKHH:'가오슝', TWKEL:'지룽', TWTXG:'타이중',
  USLAX:'로스앤젤레스', USLGB:'롱비치', USNYC:'뉴욕', USSAV:'사바나',
  USHOU:'휴스턴', USSEA:'시애틀', USORF:'노퍽', USBLT:'볼티모어',
  NLRTM:'로테르담',
  DEHAM:'함부르크', DEBRE:'브레머하펜',
  BEANR:'앤트워프',
  GBFXT:'펠릭스토우', GBSOU:'사우샘프턴', GBLIV:'리버풀',
  AEJEA:'제벨알리', AEDXB:'두바이', AEAUH:'아부다비',
  SADMM:'담맘', SAJUB:'제다', SAKHB:'킹압둘라',
  QAMES:'메사이드', QADHM:'도하',
  IRBUZ:'반다르아바스', IRBND:'반다르이맘호메이니',
  EGPSD:'포트사이드', EGSUZ:'수에즈', EGDAM:'다미에타',
  MATAN:'탕헤르메드',
  ZADUR:'더반', ZACPT:'케이프타운',
  MYPKG:'포트클랑', MYTPP:'탄중펠레파스', MYPGU:'페낭',
  VNHCM:'호치민', VNSGN:'호치민', VNDAD:'다낭',
  THLCH:'렘차방', THBKK:'방콕',
  IDJKT:'자카르타', IDSUB:'수라바야',
  INBOM:'뭄바이', INMAA:'첸나이', INPAV:'피파바브',
  LKCMB:'콜롬보',
  RUVVO:'블라디보스토크', RULED:'상트페테르부르크', RUNVS:'노보로시스크',
  ESVLC:'발렌시아', ESALG:'알헤시라스', ESBCN:'바르셀로나',
  ITGOA:'제노바', ITGIT:'지오이아타우로', ITVCE:'베네치아',
  PABLB:'발보아', PACOC:'콜론',
  BRSSZ:'산투스', BRREC:'레시피',
  AUSYD:'시드니', AUMEL:'멜버른', AUBNE:'브리즈번', AUPER:'퍼스',
};

function formatDestination(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^[-/. *?0]+$/.test(trimmed)) return null;

  // LOCODE는 보통 첫 번째 토큰 (예: "KRPUS BUSAN" → "KRPUS")
  const token = trimmed.toUpperCase().split(/[\s,/]+/)[0];

  if (/^[A-Z]{2}[A-Z0-9]{3}$/.test(token)) {
    const alpha2 = token.slice(0, 2);
    const cityKo = LOCODE_CITY_KO[token];
    const countryKo = ALPHA2_KO[alpha2];
    if (cityKo && countryKo) return `${cityKo}(${token})/${countryKo}`;
    if (cityKo) return `${cityKo}(${token})`;
    if (countryKo) return `${token}/${countryKo}`;
  }

  return trimmed.slice(0, 20);
}

function InfoRow({ label, value, valueColor }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
      <span className="text-[10px] text-white/40 font-mono shrink-0 mr-2">{label}</span>
      <span className="text-[11px] text-right font-mono truncate" style={{ color: valueColor ?? '#E2E8F0' }}>
        {value}
      </span>
    </div>
  );
}

const TABS = [
  { id: 'info',  label: '현황' },
  { id: 'cargo', label: '화물 추정' },
  { id: 'track', label: '항적' },
];

export default function ShipDetailPanel() {
  const { selectedShip, setSelectedShip, setShipTrack, clearShipTrack } = useStore();
  const [cargoResult, setCargoResult] = useState(null);
  const [cargoLoading, setCargoLoading] = useState(false);
  const [cargoError, setCargoError] = useState(null);
  const [trackData, setTrackData] = useState([]);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (!selectedShip) {
      setCargoResult(null);
      setTrackData([]);
      clearShipTrack();
      return;
    }
    setCargoResult(null);
    setCargoError(null);
    setCargoLoading(true);
    setActiveTab('info');

    runCargoEstimator(selectedShip.mmsi, selectedShip)
      .then(r => setCargoResult(r))
      .catch(e => setCargoError(e?.message ?? '추정 실패'))
      .finally(() => setCargoLoading(false));

    supabase
      .from('ship_positions')
      .select('lat, lng, recorded_at')
      .eq('mmsi', selectedShip.mmsi)
      .order('recorded_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const positions = data ?? [];
        setTrackData(positions);
        setShipTrack([...positions].reverse());
      });
  }, [selectedShip?.mmsi, selectedShip?.vessel_type]);

  if (!selectedShip) return null;

  const navInfo = NAV_STATUS_KO[selectedShip.nav_status];
  const etaStr = formatEta(selectedShip.eta);
  const flagEmoji = toFlagEmoji(selectedShip.flag_country);
  const character = SHIP_CHARACTERS[selectedShip.vessel_type] ?? SHIP_CHARACTERS['Other'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => { setSelectedShip(null); clearShipTrack(); }}
      />

      {/* 패널 */}
      <div className="relative w-full max-w-lg mx-4 max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10">

        {/* 캐릭터 헤더 */}
        <div
          className="relative flex-shrink-0 px-6 pt-6 pb-4"
          style={{ background: `linear-gradient(135deg, ${character.bgFrom} 0%, ${character.bgTo} 100%)` }}
        >
          {/* 닫기 */}
          <button
            onClick={() => { setSelectedShip(null); clearShipTrack(); }}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-black/30 text-white/60 hover:text-white hover:bg-black/50 transition-colors text-sm"
          >
            ✕
          </button>

          {/* 장식 패턴 */}
          <div className="absolute inset-0 border-b border-white/10 pointer-events-none" />
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '6px 6px' }}
          />

          {/* 캐릭터 이미지 + 정보 */}
          <div className="flex items-start gap-4">
            {/* 캐릭터 이미지 */}
            <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-white/20 bg-black/30 flex items-center justify-center">
              {character.image ? (
                <img
                  src={character.image}
                  alt={character.nameEn}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
              ) : null}
              <span
                className="text-4xl"
                style={{ display: character.image ? 'none' : 'flex' }}
              >
                {character.symbolEmoji}
              </span>
            </div>

            {/* 직함·선박 국적 */}
            <div className="flex-1 min-w-0">
              {flagEmoji && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-lg">{flagEmoji}</span>
                  <span className="text-[11px] text-white/60">
                    {ALPHA3_KO[selectedShip.flag_country?.toUpperCase()] ?? selectedShip.flag_country}
                  </span>
                </div>
              )}
              <p className="text-sm font-semibold text-white leading-snug">
                {character.title}
              </p>
            </div>
          </div>

          {/* 선박명 배지 */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[9px] text-white/30 font-mono uppercase tracking-widest">탑승 선박</span>
            <span className="text-[11px] text-white font-mono font-bold">
              {selectedShip.ship_name || '선명 미상'}
            </span>
            <span className="text-[9px] text-white/30 font-mono">· MMSI {selectedShip.mmsi}</span>
          </div>

          {/* 명언 */}
          <div className="mt-2 pl-4 border-l-2 border-white/20">
            <p className="text-[11px] italic text-white/60 leading-relaxed">
              {character.quote}
            </p>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-white/10 bg-[#0C111F] shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-mono tracking-wide transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-blue-500 bg-blue-500/10'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto bg-[#0C111F]">

          {/* ── 현황 탭 ── */}
          {activeTab === 'info' && (
            <div className="p-4 space-y-4">
              {/* 선박 정보 */}
              <div>
                <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-2">🚢 선박 정보</p>
                <InfoRow
                  label="선종"
                  value={VESSEL_TYPE_KO[selectedShip.vessel_type] ?? selectedShip.vessel_type}
                />
                <InfoRow
                  label="운항 상태"
                  value={navInfo?.label}
                  valueColor={navInfo?.color}
                />
                <InfoRow label="목적지" value={formatDestination(selectedShip.destination)} />
                <InfoRow label="도착 예정" value={etaStr} />
                <InfoRow label="IMO" value={selectedShip.imo} />
                <InfoRow label="콜사인" value={selectedShip.call_sign} />
              </div>

              {/* 속도·위치 */}
              <div>
                <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-2">📡 현재 위치</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '속도', value: `${selectedShip.speed ?? '-'} kn` },
                    { label: '위도',  value: selectedShip.lat?.toFixed(3) ?? '-' },
                    { label: '경도',  value: selectedShip.lng?.toFixed(3) ?? '-' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/5 rounded-lg px-2 py-2 text-center">
                      <p className="text-[9px] text-white/40 font-mono">{label}</p>
                      <p className="text-xs font-mono text-white mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 화물 추정 탭 ── */}
          {activeTab === 'cargo' && (
            <div className="p-4">
              <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-3">📦 화물 추정 (AI)</p>
              {cargoLoading && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] text-white/40 animate-pulse">Claude AI 분석 중...</p>
                </div>
              )}
              {cargoError && (
                <p className="text-xs text-red-400 py-4 text-center">{cargoError}</p>
              )}
              {cargoResult && (
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-white/40 font-mono">추정 적재량</span>
                      <span className="text-[11px] text-white font-mono font-bold">
                        {cargoResult.estimated_load_tons?.toLocaleString()}t
                        {cargoResult.load_ratio_pct != null && ` (${cargoResult.load_ratio_pct}%)`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-white/40 font-mono">신뢰도</span>
                      <span className="text-[11px] text-white">{cargoResult.confidence}</span>
                    </div>
                    {cargoResult.estimated_passengers != null && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-white/40 font-mono">추정 탑승객</span>
                        <span className="text-[11px] text-blue-300 font-mono">
                          {cargoResult.estimated_passengers?.toLocaleString()}명
                        </span>
                      </div>
                    )}
                    {cargoResult.estimated_catch_tons != null && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-white/40 font-mono">추정 어획량</span>
                        <span className="text-[11px] text-teal-300 font-mono">
                          {cargoResult.estimated_catch_tons?.toLocaleString()}t
                        </span>
                      </div>
                    )}
                  </div>

                  {cargoResult.cargo_distribution?.length > 0 && (
                    <div>
                      <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-2">화물 분포</p>
                      <div className="space-y-2">
                        {cargoResult.cargo_distribution.slice(0, 4).map((item, i) => (
                          <div key={i} className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-white/80 truncate pr-2">{item.item}</span>
                              <span className="font-mono text-white/40 shrink-0">{item.probability_pct}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded overflow-hidden">
                              <div
                                className="h-full bg-blue-500/60 rounded"
                                style={{ width: `${item.probability_pct}%` }}
                              />
                            </div>
                            {item.annotation && (
                              <p className="text-[9px] text-white/40 leading-tight">{item.annotation}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cargoResult.disclaimer && (
                    <p className="text-[9px] text-white/30 leading-tight border-t border-white/10 pt-2">
                      {cargoResult.disclaimer}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 항적 탭 ── */}
          {activeTab === 'track' && (
            <div className="p-4">
              <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-3">
                🗺️ 최근 항적 ({trackData.length}포인트)
              </p>
              {trackData.length === 0 ? (
                <p className="text-[11px] text-white/30 py-6 text-center">항적 데이터 없음</p>
              ) : (
                <div className="space-y-1">
                  {trackData.slice(0, 30).map((pos, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? 'bg-blue-400' : 'bg-white/20'}`} />
                      <span className="text-[10px] font-mono text-white/40 shrink-0 w-32">
                        {pos.recorded_at?.slice(5, 16).replace('T', ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-white/60">
                        {pos.lat?.toFixed(3)}, {pos.lng?.toFixed(3)}
                      </span>
                    </div>
                  ))}
                  {trackData.length > 30 && (
                    <p className="text-[9px] text-white/20 text-center pt-2">
                      ... 외 {trackData.length - 30}개
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
