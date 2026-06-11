const XLSX = require('xlsx');
const path = require('path');

const STYLE_PREFIX = 'Epic oil painting portrait, Civilization VI video game leader portrait style, digital art, highly detailed, dramatic chiaroscuro side lighting, dark moody atmospheric background, 8k resolution, game concept art';

const SHIP_CHARACTERS = [
  {
    filename: 'ship_container.png',
    type: '선박',
    vessel_type: 'Container Ship',
    name_ko: '박서연',
    name_en: 'Park Seo-yeon',
    title: '글로벌 컨테이너 선단 선장',
    nationality: '한국',
    gender: '여',
    prompt_body: 'Korean woman in her early 40s, global container ship captain, crisp white naval captain uniform with gold epaulettes and four stripes, short black hair, confident steady gaze, background showing massive container ship silhouette and port cranes at dusk with warm amber light',
  },
  {
    filename: 'ship_tanker.png',
    type: '선박',
    vessel_type: 'Tanker',
    name_ko: '카림 알-라시드',
    name_en: 'Karim Al-Rashid',
    title: '원유 탱커 수석 엔지니어',
    nationality: '아랍계 (UAE)',
    gender: '남',
    prompt_body: 'Arab man in his late 40s, oil tanker chief engineer, navy blue coveralls with orange safety stripes and company patches, short beard flecked with gray, serious professional expression, background showing oil tanker deck at sea with refinery silhouette and orange flame glow',
  },
  {
    filename: 'ship_bulk.png',
    type: '선박',
    vessel_type: 'Bulk Carrier',
    name_ko: '아마두 디알로',
    name_en: 'Amadou Diallo',
    title: '벌크선 화물장',
    nationality: '서아프리카계 (세네갈)',
    gender: '남',
    prompt_body: 'West African man in his 50s, bulk carrier cargo master, weathered navy work jacket, strong build, gray-streaked beard, wise calm expression, background showing bulk carrier loaded with iron ore at sunset, red and gold tones',
  },
  {
    filename: 'ship_lng.png',
    type: '선박',
    vessel_type: 'LNG Carrier',
    name_ko: '소피아 베르그',
    name_en: 'Sofia Berg',
    title: 'LNG 안전관제 책임자',
    nationality: '북유럽계 (노르웨이)',
    gender: '여',
    prompt_body: 'Scandinavian woman in her mid-30s, LNG carrier safety officer, white safety helmet pushed back, bright orange fire-retardant coveralls, blonde hair tied back, sharp analytical eyes, background showing massive spherical LNG tanks on carrier deck under cold blue sky',
  },
  {
    filename: 'ship_passenger.png',
    type: '선박',
    vessel_type: 'Passenger',
    name_ko: '아르준 메타',
    name_en: 'Arjun Mehta',
    title: '크루즈 선장',
    nationality: '남아시아계 (인도)',
    gender: '남',
    prompt_body: 'Indian man in his 50s, luxury cruise ship captain, pristine white dress uniform with four gold stripes and medal ribbons, salt-and-pepper hair and mustache, commanding dignified presence, background showing grand cruise ship lit up at night on calm sea',
  },
  {
    filename: 'ship_fishing.png',
    type: '선박',
    vessel_type: 'Fishing',
    name_ko: '마리아 산토스',
    name_en: 'Maria Santos',
    title: '원양어선 선장',
    nationality: '동남아시아계 (필리핀)',
    gender: '여',
    prompt_body: 'Filipino woman in her 40s, deep sea fishing captain, weathered orange rain slicker and rubber boots, dark hair with streaks of gray tied back, determined weathered face, background showing fishing vessel with nets in rough deep ocean, stormy sky',
  },
  {
    filename: 'ship_special.png',
    type: '선박',
    vessel_type: 'Special Craft',
    name_ko: '후안 카레라',
    name_en: 'Juan Carrera',
    title: '해양 구조·특수 작전 지휘관',
    nationality: '라틴아메리카계 (칠레)',
    gender: '남',
    prompt_body: 'Latin American man in his 40s, special craft naval rescue commander, dark navy tactical uniform with patches, short dark hair, intense focused expression with strong jaw, background showing tugboat and salvage crane at work, dramatic stormy sea',
  },
  {
    filename: 'ship_other.png',
    type: '선박',
    vessel_type: 'Other',
    name_ko: '아이나 오베르그',
    name_en: 'Aina Åberg',
    title: '미지 항로 항법사',
    nationality: '사미족/스칸디나비아',
    gender: '여',
    prompt_body: 'Sámi-Scandinavian woman in her early 30s, unknown seas navigator, traditional Sámi-inspired coat with colorful geometric border patterns, dark braided hair with silver adornments, mysterious knowing expression, background showing dense arctic fog over dark unknown sea',
  },
];

const REGION_CHARACTERS = [
  // 초크포인트
  { filename:'region_suez.png', type:'초크포인트', region_id:'suez', name_ko:'가말 압델 나세르', name_en:'Gamal Abdel Nasser', title:'이집트 제2대 대통령 · 수에즈 국유화 1956', prompt_body:'Egyptian man in his 40s, charismatic Arab nationalist leader, 1950s military dress uniform with medals, confident bold expression, background showing Suez Canal with ships passing, Egyptian desert dusk' },
  { filename:'region_malacca.png', type:'초크포인트', region_id:'malacca', name_ko:'항 투아', name_en:'Hang Tuah', title:'말라카 전설의 제독 · 15세기', prompt_body:'Malay legendary warrior admiral, 15th century, ornate traditional Malay warrior armor (baju zirah) with intricate gold detailing, keris dagger at belt, fierce loyal expression, background showing Strait of Malacca with ancient Malay ships' },
  { filename:'region_hormuz.png', type:'초크포인트', region_id:'hormuz', name_ko:'다리우스 대왕', name_en:'Darius the Great', title:'페르시아 아케메네스 제국 3대 왕 · 기원전 550~486', prompt_body:'Persian king, 500 BC, elaborate Achaemenid royal robes with golden patterns, tall ornate Persian crown (kolah), long carefully groomed beard with gold ornaments, regal commanding expression, background showing Persian Gulf with Persepolis columns' },
  { filename:'region_panama.png', type:'초크포인트', region_id:'panama', name_ko:'오마르 토리호스', name_en:'Omar Torrijos', title:'파나마 최고지도자 · 운하 반환 협상가 1968~1981', prompt_body:'Panamanian military leader, 1970s, olive green military uniform with general\'s insignia, determined populist expression, background showing Panama Canal locks with ships transiting' },
  { filename:'region_dover.png', type:'초크포인트', region_id:'dover', name_ko:'호레이쇼 넬슨 제독', name_en:'Admiral Horatio Nelson', title:'영국 해군 원수 · 트라팔가르 해전 영웅 1805', prompt_body:'British naval hero, early 1800s, Royal Navy admiral dress uniform with gold epaulettes and decorations, empty right sleeve (Tenerife wound), missing right eye covered, heroic resolute expression, background showing HMS Victory and white cliffs of Dover' },
  { filename:'region_korea_strait.png', type:'초크포인트', region_id:'korea_strait', name_ko:'이순신', name_en:'Yi Sun-sin', title:'조선 삼도수군통제사 · 1545~1598', prompt_body:'Korean admiral, Joseon dynasty 1590s, ornate joseon military general armor (gapot helmet, jeongbok) with commanding presence, calm determined expression, background showing turtle ship (geobukseon) on dark sea with fire' },
  { filename:'region_bab_el_mandeb.png', type:'초크포인트', region_id:'bab_el_mandeb', name_ko:'시바의 여왕', name_en:'Queen of Sheba', title:'예멘·에티오피아의 전설적 여왕 · 기원전 10세기', prompt_body:'Legendary ancient queen, 10th century BC, elaborate ancient Sabaean/Ethiopian royal attire with gold jewelry and headdress, mysterious powerful presence, rich dark skin, background showing ancient Arabian sea trade route with incense smoke' },
  // 항만
  { filename:'region_busan.png', type:'항만', region_id:'busan', name_ko:'장보고', name_en:'Jang Bogo', title:'신라 해상왕 · 9세기 동아시아 무역 제패', prompt_body:'Korean sea merchant king, Silla dynasty 9th century, Tang-influenced Korean armor with blue and gold, sword at side, ambitious visionary expression, background showing ancient East Asian trading ships at sea' },
  { filename:'region_incheon.png', type:'항만', region_id:'incheon', name_ko:'강감찬', name_en:'Gang Gam-chan', title:'고려 명장 · 귀주대첩으로 거란 격퇴 1019', prompt_body:'Korean general, Goryeo dynasty 1019, traditional Goryeo military commander armor, elderly wise face, strategic calm expression, background showing battlefield with armies at Gwiju' },
  { filename:'region_gwangyang.png', type:'항만', region_id:'gwangyang', name_ko:'박태준', name_en:'Park Tae-joon', title:'포스코 설립자 · 한국 철강산업의 아버지', prompt_body:'Korean industrial visionary, 1970s, sharp dark business suit with hardhat tucked under arm, determined builder\'s expression, background showing POSCO steel mill with molten steel and smoky industrial glow' },
  { filename:'region_singapore.png', type:'항만', region_id:'singapore', name_ko:'리콴유', name_en:'Lee Kuan Yew', title:'싱가포르 초대 총리 · 건국의 아버지 1959~1990', prompt_body:'Singapore\'s founding father, 1960s-80s, crisp white short-sleeve shirt and tie, sharp intelligent eyes, authoritative statesman expression, background showing Singapore harbor and city skyline at dawn' },
  { filename:'region_shanghai.png', type:'항만', region_id:'shanghai', name_ko:'정화', name_en:'Zheng He', title:'명나라 대항해사 · 1405~1433년 7차 대원정', prompt_body:'Ming dynasty admiral, early 1400s, elaborate Ming court eunuch admiral robes with dragon embroidery and red sash, large imposing presence, commanding expression, background showing Ming treasure fleet (baochuan) on open sea' },
  { filename:'region_rotterdam.png', type:'항만', region_id:'rotterdam', name_ko:'에라스무스', name_en:'Desiderius Erasmus', title:'로테르담 출신 인문학자 · 1469~1536', prompt_body:'Dutch Renaissance scholar, early 1500s, black scholar\'s robes and academic cap, quill pen in hand, open book, thoughtful intellectual expression, background showing Rotterdam harbor with Renaissance-era ships' },
  { filename:'region_la_lb.png', type:'항만', region_id:'la_lb', name_ko:'매슈 페리 제독', name_en:'Commodore Matthew Perry', title:'미 해군 제독 · 태평양 무역로 개척 1853', prompt_body:'American naval commodore, 1850s, US Navy dress uniform with gold braid and epaulettes, sideburns and stern expression, background showing black steam warships (Black Ships) in Japanese bay' },
  { filename:'region_dubai.png', type:'항만', region_id:'dubai', name_ko:'라시드 빈 사이드', name_en:'Sheikh Rashid bin Saeed Al Maktoum', title:'두바이 근대화의 아버지 · 재위 1958~1990', prompt_body:'Dubai\'s modernizing ruler, 1960s-70s, pristine white kandura (thobe) with traditional ghutra and agal headdress, wise visionary expression, background showing Dubai Creek transforming from desert port to modern skyline' },
  { filename:'region_yokohama.png', type:'항만', region_id:'yokohama', name_ko:'사카모토 료마', name_en:'Sakamoto Ryoma', title:'막말 지사 · 일본 개국·근대화 선구자 1836~1867', prompt_body:'Japanese Meiji revolutionary, 1860s, unique mix of traditional hakama and Western boots and pistol at hip, long dark hair, adventurous passionate expression, background showing Yokohama harbor with first Western ships arriving in Japan' },
  { filename:'region_kobe.png', type:'항만', region_id:'kobe', name_ko:'타이라노 키요모리', name_en:'Taira no Kiyomori', title:'헤이안 말기 무장 · 효고 항구 개발자 1118~1181', prompt_body:'Japanese Heian-era warlord, 1150s, ornate lacquered red and gold samurai armor (oyoroi), powerful aristocratic expression, background showing Kobe coast with ancient Japanese harbor development' },
  { filename:'region_ningbo.png', type:'항만', region_id:'ningbo', name_ko:'왕직', name_en:'Wang Zhi', title:'명나라 해상 무역상 · 동아시아 밀무역의 왕 ?~1559', prompt_body:'Ming era Chinese maritime merchant-pirate king, mid-1500s, wealthy merchant robes with hidden armor, cunning wealthy expression, background showing East China Sea with merchant junks under moonlight' },
  { filename:'region_shenzhen.png', type:'항만', region_id:'shenzhen', name_ko:'덩샤오핑', name_en:'Deng Xiaoping', title:'중국 최고 지도자 · 개혁개방·선전 경제특구 창설 1904~1997', prompt_body:'Chinese paramount leader, 1980s, Mao suit (Zhongshan suit) in dark blue, small compact figure, pragmatic confident expression, background showing Shenzhen transforming from rice paddies to skyscrapers' },
  { filename:'region_hongkong.png', type:'항만', region_id:'hongkong', name_ko:'린쩌쉬', name_en:'Lin Zexu', title:'청나라 흠차대신 · 아편전쟁 저항의 영웅 1785~1850', prompt_body:'Qing dynasty official, 1830s, elaborate high-ranking Qing mandarin court robes with peacock feather hat, righteous indignant expression, background showing Hong Kong harbor with British opium ships and bonfires' },
  { filename:'region_vladivostok.png', type:'항만', region_id:'vladivostok', name_ko:'무라비요프-아무르스키', name_en:'Nikolai Muravyov-Amursky', title:'러시아 동시베리아 총독 · 블라디보스토크 창건 1809~1881', prompt_body:'Russian Imperial governor, 1850s, Imperial Russian military general uniform with medals and fur-trimmed coat, expansionist determined expression, background showing Siberian wilderness and newly founded Vladivostok harbor' },
  { filename:'region_portklang.png', type:'항만', region_id:'portklang', name_ko:'파라메스와라', name_en:'Parameswara', title:'말라카 술탄국 창건자 · 동남아 무역 제국 1344~1414', prompt_body:'Malacca Sultanate founder, early 1400s, elaborate Malay royal court attire with gold keris and royal headdress, strategic ambitious expression, background showing ancient Malacca port with spice trade ships' },
  { filename:'region_mumbai.png', type:'항만', region_id:'mumbai', name_ko:'시바지 마하라지', name_en:'Chhatrapati Shivaji Maharaj', title:'마라타 제국 창건자 · 인도 최초 근대 해군 건설 1630~1680', prompt_body:'Maratha Empire founder, 1660s-70s, magnificent Maratha warrior king armor with jeweled helmet and sword, heroic fierce expression, background showing Maratha naval warships and Maharashtra coast' },
  { filename:'region_hamburg.png', type:'항만', region_id:'hamburg', name_ko:'사자공 하인리히', name_en:'Henry the Lion', title:'작센·바이에른 공작 · 함부르크 항만 창건 1129~1195', prompt_body:'German Saxon duke, 12th century, heavy medieval European plate and chainmail armor with lion crest, powerful feudal lord expression, background showing Hamburg medieval harbor with Hanseatic trading cogs' },
  { filename:'region_newyork.png', type:'항만', region_id:'newyork', name_ko:'알렉산더 해밀턴', name_en:'Alexander Hamilton', title:'미국 초대 재무장관 · 뉴욕 금융·무역 체계 설계 1755~1804', prompt_body:'American Founding Father, 1790s, colonial American gentleman attire with waistcoat and cravat, quill and ledger, sharp intellectual ambitious expression, background showing early New York Harbor with tall ships' },
  { filename:'region_guangzhou.png', type:'항만', region_id:'guangzhou', name_ko:'쑨원', name_en:'Sun Yat-sen', title:'중화민국 임시대총통 · 중국 근대 혁명의 아버지 1866~1925', prompt_body:'Chinese revolutionary leader, 1910s, Zhongshan suit (Sun Yat-sen suit) with mandarin collar, compassionate visionary expression, background showing Guangzhou Canton with revolutionary crowds' },
  { filename:'region_qingdao.png', type:'항만', region_id:'qingdao', name_ko:'강태공', name_en:'Jiang Taigong', title:'주나라 개국공신 · 제나라(산둥) 시조 기원전 11세기', prompt_body:'Zhou dynasty legendary strategist, 11th century BC, ancient Chinese scholar-warrior robes with fishing rod, elderly wise figure, serene strategic expression, background showing ancient Shandong coastline with dawn light' },
  { filename:'region_tianjin.png', type:'항만', region_id:'tianjin', name_ko:'이홍장', name_en:'Li Hongzhang', title:'청나라 직예총독 · 양무운동 주도 1823~1901', prompt_body:'Qing dynasty grand official, 1870s-1890s, ornate high-ranking Qing mandarin robes with yellow rank badge, aged pragmatic modernizer expression, background showing Tianjin port with both Western ships and Chinese junks' },
  { filename:'region_antwerp.png', type:'항만', region_id:'antwerp', name_ko:'피터 폴 루벤스', name_en:'Peter Paul Rubens', title:'앤트워프 출신 바로크 화가 · 외교관 1577~1640', prompt_body:'Flemish baroque master painter, early 1600s, 17th century Flemish aristocrat clothing with ruff collar, palette and brushes, charming diplomat expression, background showing Antwerp Cathedral and prosperous merchant harbor' },
  { filename:'region_tanjung_pelepas.png', type:'항만', region_id:'tanjung_pelepas', name_ko:'술탄 아부 바카르', name_en:'Sultan Abu Bakar of Johor', title:'조호르 술탄국 아버지 · 근대 조호르 창건 1833~1895', prompt_body:'Johor Sultan, late 1800s, elaborate Malay royal ceremonial attire with royal songkok hat and medals, modernizing monarch expression, background showing Johor coastline with trade ships' },
  { filename:'region_xiamen.png', type:'항만', region_id:'xiamen', name_ko:'정성공', name_en:'Koxinga (Zheng Chenggong)', title:'명나라 충신 · 샤먼 기반 해상 왕국 건설 1624~1662', prompt_body:'Ming loyalist sea king, 1650s, Ming dynasty military commander armor with battle standard, fierce loyal defiant expression, background showing Xiamen harbor with Ming loyalist fleet' },
  { filename:'region_kaohsiung.png', type:'항만', region_id:'kaohsiung', name_ko:'리덩후이', name_en:'Lee Teng-hui', title:'중화민국 제9대 총통 · 대만 민주화의 아버지 1923~2020', prompt_body:'Taiwan president, 1990s, modern dark suit with Taiwan tie pin, democratic elder statesman expression, background showing Kaohsiung port with industrial skyline and Taiwan flag colors' },
  { filename:'region_laem_chabang.png', type:'항만', region_id:'laem_chabang', name_ko:'쭐랄롱꼰 대왕', name_en:'King Chulalongkorn (Rama V)', title:'태국 국왕 라마 5세 · 근대화 개혁 1853~1910', prompt_body:'Thai king, late 1800s-early 1900s, elaborate Thai royal military uniform with golden decorations and royal regalia, reformist visionary expression, background showing Gulf of Thailand with royal Thai ships' },
  { filename:'region_jakarta.png', type:'항만', region_id:'jakarta', name_ko:'수카르노', name_en:'Sukarno', title:'인도네시아 초대 대통령 · 독립운동 지도자 1901~1970', prompt_body:'Indonesia\'s first president, 1940s-50s, khaki military uniform with peci (black velvet hat), charismatic nationalist orator expression, background showing Jakarta harbor with Indonesian independence flag' },
  { filename:'region_colombo.png', type:'항만', region_id:'colombo', name_ko:'파라크라마바후 1세', name_en:'Parakramabahu I', title:'스리랑카 폴론나루와 왕국 왕 · 1123~1186', prompt_body:'Sri Lankan king of Polonnaruwa, 1150s, elaborate ancient Sri Lankan royal warrior attire with golden crown and jewels, powerful builder-king expression, background showing ancient Sri Lanka port with Buddhist stupa and Indian Ocean' },
  { filename:'region_savannah.png', type:'항만', region_id:'savannah', name_ko:'제임스 오글소프', name_en:'James Oglethorpe', title:'조지아 식민지 창건자 · 사바나 도시 설계 1696~1785', prompt_body:'British colonial founder, 1730s, British colonial military officer attire with tricorn hat, idealistic reformer expression, background showing early Savannah grid plan settlement and Georgia coastline' },
  { filename:'region_hochiminhcity.png', type:'항만', region_id:'hochiminhcity', name_ko:'호찌민', name_en:'Ho Chi Minh', title:'베트남 민주공화국 초대 주석 · 독립운동 지도자 1890~1969', prompt_body:'Vietnamese revolutionary leader, 1940s-50s, simple khaki tunic and trousers (Vietnamese revolutionary style), long thin beard, gentle but resolute expression, background showing Saigon river with Vietnamese revolutionary imagery and jungle' },
];

// Build rows
function makeRow(char) {
  const prompt = STYLE_PREFIX + ', ' + char.prompt_body;
  return {
    '파일명': char.filename,
    '종류': char.type,
    'ID / 선종': char.region_id || char.vessel_type || '',
    '이름 (한국어)': char.name_ko,
    '이름 (영어)': char.name_en,
    '직함 / 역할': char.title,
    '성별': char.gender || '',
    '국적 / 배경': char.nationality || '',
    '이미지 생성 프롬프트 (영어)': prompt,
  };
}

const shipRows = SHIP_CHARACTERS.map(makeRow);
const regionRows = REGION_CHARACTERS.map(makeRow);
const allRows = [...shipRows, ...regionRows];

// Create workbook
const wb = XLSX.utils.book_new();

// Sheet 1: 전체 목록
const ws1 = XLSX.utils.json_to_sheet(allRows);
// Set column widths
ws1['!cols'] = [
  { wch: 30 },  // 파일명
  { wch: 10 },  // 종류
  { wch: 20 },  // ID/선종
  { wch: 18 },  // 이름 한국어
  { wch: 28 },  // 이름 영어
  { wch: 40 },  // 직함
  { wch: 6 },   // 성별
  { wch: 22 },  // 국적
  { wch: 120 }, // 프롬프트
];
XLSX.utils.book_append_sheet(wb, ws1, '전체 캐릭터 목록');

// Sheet 2: 선박 캐릭터만
const ws2 = XLSX.utils.json_to_sheet(shipRows);
ws2['!cols'] = ws1['!cols'];
XLSX.utils.book_append_sheet(wb, ws2, '선박 캐릭터 (8)');

// Sheet 3: 지역 캐릭터만
const ws3 = XLSX.utils.json_to_sheet(regionRows);
ws3['!cols'] = ws1['!cols'];
XLSX.utils.book_append_sheet(wb, ws3, '지역 캐릭터 (37)');

const outPath = path.join(__dirname, '../seabird_characters.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Excel saved:', outPath);
console.log('Total rows:', allRows.length, '(선박 8 + 지역 37)');
