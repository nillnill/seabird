// X CAPITAL 투자 데스크 페르소나 3인 (드라마 Billions 모티프).
// 각 페르소나는 한 섹터 데스크를 맡아 우리 해양 대안데이터로 투자 아이디어를 제시한다.
// key는 서버 xcapData.js의 DESKS[].key와 일치해야 함 (raw_data.desks 매칭).
export const INVESTMENT_PERSONAS = {
  axelrod: {
    key: 'axelrod',
    name: 'Bobby Axelrod',
    nameEn: 'Bobby "Axe" Axelrod',
    title: 'CIO · 컨테이너·해운 데스크',
    desk: '컨테이너·해운',
    flagEmoji: '🇺🇸',
    symbolEmoji: '📦',
    quote: '"혼잡이 깊을수록, 베팅은 커진다."',
    blurb: '항만 혼잡지수와 컨테이너 운임의 방향성에 공격적으로 베팅한다.',
    strategy: {
      framework: '부산·LA·로테르담의 적체가 깊어지고 KCCI 컨테이너 운임이 함께 오르면, 선사의 운임 협상력이 커져 실적 레버리지가 폭발한다. 그 동행을 포착해 해운주에 공격적으로 방향성 베팅한다.',
      reads: [
        { metric: '혼잡지수', how: '항만 적체 = 공급 병목 → 운임 상승을 선행하는 신호' },
        { metric: '입항 선박수·체류시간', how: '물동량과 선석 회전 — 적체가 일시적인지 구조적인지 판별' },
        { metric: 'KCCI 운임', how: '선사 실적에 직접 반영되는 최종 확인 지표' },
      ],
      playbook: 'LONG = 혼잡↑ + KCCI↑ 동행 · SHORT = 운임 급락 + 체류 단축(수요 둔화) · HOLD = 혼잡만↑·운임 정체',
    },
    bgFrom: '#0A1628',
    bgTo: '#15324F',
    accent: '#3B82F6',
    image: '/characters/xcap_axelrod.webp',
    equities: ['HMM', '팬오션', '대한해운'],
  },
  taylor: {
    key: 'taylor',
    name: 'Taylor Mason',
    nameEn: 'Taylor Amber Mason',
    title: '퀀트 · 건화물·철강 데스크',
    desk: '건화물·철강',
    flagEmoji: '🇺🇸',
    symbolEmoji: '⚓',
    quote: '"데이터는 감정이 없다. 흘수가 진실을 말한다."',
    blurb: '벌크선 입항·흘수 변화와 KDCI 건화물운임을 정량 모델로 해석한다.',
    strategy: {
      framework: '감정 없는 정량 모델. 제철소(광양·포항·당진)로 들어오는 철광석·석탄 물동량과 KDCI 건화물 운임, 해양수산부 공식 처리량을 교차검증해 철강 수요를 읽는다. 원료 유입↑과 운임↑이 확인되면 철강주 LONG.',
      reads: [
        { metric: '벌크 입항·유입(DWT)', how: '제철 원료(철광석·석탄) 수요의 실시간 프록시' },
        { metric: '공식 철광석·유연탄 처리량', how: 'AIS 사각지대를 메우는 정부 공식 수치 — 1차 판단 근거' },
        { metric: 'KDCI 운임', how: '건화물 수급 균형 → 원료 조달 강도·비용' },
      ],
      playbook: 'LONG = 공식 처리량↑ + KDCI↑ · SHORT = 처리량 감소 + 운임 급락 · HOLD = 신호 혼재',
    },
    bgFrom: '#1A1400',
    bgTo: '#3D2F00',
    accent: '#F59E0B',
    image: '/characters/xcap_taylor.webp',
    equities: ['POSCO홀딩스', '현대제철', '대한제강'],
  },
  wagner: {
    key: 'wagner',
    name: 'Mike Wagner',
    nameEn: 'Mike "Wags" Wagner',
    title: 'COO · 에너지·정유 데스크',
    desk: '에너지·정유',
    flagEmoji: '🇺🇸',
    symbolEmoji: '🛢️',
    quote: '"원유는 거짓말을 하지 않아. 탱커가 말해주거든."',
    blurb: '탱커 입항·원유 유입과 유가·지정학을 거시 직관으로 읽는다.',
    strategy: {
      framework: '거시·지정학 직관 + 탱커가 말하는 진실. 울산·여수 정유단지로 들어오는 원유 탱커와 BDTI 더티탱커 운임, 공식 원유·석유제품 처리량으로 정제 가동률과 수요를 읽는다. 원유 유입과 운임이 동반 강세면 정유주 LONG.',
      reads: [
        { metric: '탱커 입항·원유 유입(DWT)', how: '정유사 가동률·원유 수요의 직접 신호' },
        { metric: '공식 원유·석유정제품 처리량', how: '정부 공식 정제 물동량 — 핵심 판단 근거' },
        { metric: 'BDTI 운임', how: '원유 해상운송 수요 = 글로벌 원유 물동량 강도' },
      ],
      playbook: 'LONG = 원유 유입↑ + BDTI↑ · SHORT = 처리량 급감 + 운임 붕괴 · HOLD = 신호 혼재',
    },
    bgFrom: '#1A0A00',
    bgTo: '#3D1A00',
    accent: '#EF4444',
    image: '/characters/xcap_wagner.webp',
    equities: ['S-Oil', 'GS', 'SK이노베이션'],
  },
};

export const PERSONA_ORDER = ['axelrod', 'taylor', 'wagner'];
