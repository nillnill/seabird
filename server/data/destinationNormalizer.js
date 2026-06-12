// AIS destination(자유텍스트) 정규화·분류.
// 입력 예: "BUSAN", "BUSAN KOREA", "KRPUS", "NL RTM", "PLGDY", "FOR ORDERS", "FISHING"
// 출력: { raw, country(ISO3|null), countryKo, port(표시명|null), category }
//   category: 'port'(항구/국가 식별됨) | 'other'(작업·미항구) | 'unknown'(미식별) | 'none'(빈값)
// ※ src/utils/destinationNormalizer.js (ESM)에서 자동 생성됨 — 직접 수정 금지.

// ISO2(LOCODE 앞 2자) → { iso3, ko }. 주요 해운국 중심.
const ISO2 = {
  KR:{iso3:'KOR',ko:'한국'}, KP:{iso3:'PRK',ko:'북한'}, JP:{iso3:'JPN',ko:'일본'}, CN:{iso3:'CHN',ko:'중국'},
  TW:{iso3:'TWN',ko:'대만'}, HK:{iso3:'HKG',ko:'홍콩'}, MO:{iso3:'MAC',ko:'마카오'}, SG:{iso3:'SGP',ko:'싱가포르'},
  MY:{iso3:'MYS',ko:'말레이시아'}, ID:{iso3:'IDN',ko:'인도네시아'}, TH:{iso3:'THA',ko:'태국'}, VN:{iso3:'VNM',ko:'베트남'},
  PH:{iso3:'PHL',ko:'필리핀'}, KH:{iso3:'KHM',ko:'캄보디아'}, MM:{iso3:'MMR',ko:'미얀마'}, BN:{iso3:'BRN',ko:'브루나이'},
  IN:{iso3:'IND',ko:'인도'}, PK:{iso3:'PAK',ko:'파키스탄'}, BD:{iso3:'BGD',ko:'방글라데시'}, LK:{iso3:'LKA',ko:'스리랑카'},
  AE:{iso3:'ARE',ko:'UAE'}, SA:{iso3:'SAU',ko:'사우디'}, QA:{iso3:'QAT',ko:'카타르'}, KW:{iso3:'KWT',ko:'쿠웨이트'},
  BH:{iso3:'BHR',ko:'바레인'}, OM:{iso3:'OMN',ko:'오만'}, IR:{iso3:'IRN',ko:'이란'}, IQ:{iso3:'IRQ',ko:'이라크'},
  IL:{iso3:'ISR',ko:'이스라엘'}, TR:{iso3:'TUR',ko:'터키'}, EG:{iso3:'EGY',ko:'이집트'}, JO:{iso3:'JOR',ko:'요르단'},
  LB:{iso3:'LBN',ko:'레바논'}, YE:{iso3:'YEM',ko:'예멘'},
  RU:{iso3:'RUS',ko:'러시아'}, UA:{iso3:'UKR',ko:'우크라이나'}, GE:{iso3:'GEO',ko:'조지아'}, KZ:{iso3:'KAZ',ko:'카자흐'},
  GB:{iso3:'GBR',ko:'영국'}, IE:{iso3:'IRL',ko:'아일랜드'}, FR:{iso3:'FRA',ko:'프랑스'}, DE:{iso3:'DEU',ko:'독일'},
  NL:{iso3:'NLD',ko:'네덜란드'}, BE:{iso3:'BEL',ko:'벨기에'}, LU:{iso3:'LUX',ko:'룩셈부르크'}, ES:{iso3:'ESP',ko:'스페인'},
  PT:{iso3:'PRT',ko:'포르투갈'}, IT:{iso3:'ITA',ko:'이탈리아'}, GR:{iso3:'GRC',ko:'그리스'}, MT:{iso3:'MLT',ko:'몰타'},
  CY:{iso3:'CYP',ko:'키프로스'}, HR:{iso3:'HRV',ko:'크로아티아'}, SI:{iso3:'SVN',ko:'슬로베니아'}, ME:{iso3:'MNE',ko:'몬테네그로'},
  MC:{iso3:'MCO',ko:'모나코'}, IM:{iso3:'IMN',ko:'맨섬'},
  CH:{iso3:'CHE',ko:'스위스'}, AT:{iso3:'AUT',ko:'오스트리아'}, PL:{iso3:'POL',ko:'폴란드'}, CZ:{iso3:'CZE',ko:'체코'},
  SK:{iso3:'SVK',ko:'슬로바키아'}, HU:{iso3:'HUN',ko:'헝가리'}, RO:{iso3:'ROU',ko:'루마니아'}, BG:{iso3:'BGR',ko:'불가리아'},
  DK:{iso3:'DNK',ko:'덴마크'}, NO:{iso3:'NOR',ko:'노르웨이'}, SE:{iso3:'SWE',ko:'스웨덴'}, FI:{iso3:'FIN',ko:'핀란드'},
  IS:{iso3:'ISL',ko:'아이슬란드'}, EE:{iso3:'EST',ko:'에스토니아'}, LV:{iso3:'LVA',ko:'라트비아'}, LT:{iso3:'LTU',ko:'리투아니아'},
  FO:{iso3:'FRO',ko:'페로'}, GI:{iso3:'GIB',ko:'지브롤터'},
  US:{iso3:'USA',ko:'미국'}, CA:{iso3:'CAN',ko:'캐나다'}, MX:{iso3:'MEX',ko:'멕시코'}, PA:{iso3:'PAN',ko:'파나마'},
  BR:{iso3:'BRA',ko:'브라질'}, AR:{iso3:'ARG',ko:'아르헨티나'}, CL:{iso3:'CHL',ko:'칠레'}, PE:{iso3:'PER',ko:'페루'},
  CO:{iso3:'COL',ko:'콜롬비아'}, EC:{iso3:'ECU',ko:'에콰도르'}, UY:{iso3:'URY',ko:'우루과이'}, VE:{iso3:'VEN',ko:'베네수엘라'},
  CR:{iso3:'CRI',ko:'코스타리카'}, DO:{iso3:'DOM',ko:'도미니카'}, JM:{iso3:'JAM',ko:'자메이카'}, BS:{iso3:'BHS',ko:'바하마'},
  CU:{iso3:'CUB',ko:'쿠바'}, TT:{iso3:'TTO',ko:'트리니다드'}, GT:{iso3:'GTM',ko:'과테말라'}, HN:{iso3:'HND',ko:'온두라스'},
  ZA:{iso3:'ZAF',ko:'남아공'}, MA:{iso3:'MAR',ko:'모로코'}, DZ:{iso3:'DZA',ko:'알제리'}, TN:{iso3:'TUN',ko:'튀니지'},
  LY:{iso3:'LBY',ko:'리비아'}, NG:{iso3:'NGA',ko:'나이지리아'}, GH:{iso3:'GHA',ko:'가나'}, CI:{iso3:'CIV',ko:'코트디부아르'},
  SN:{iso3:'SEN',ko:'세네갈'}, AO:{iso3:'AGO',ko:'앙골라'}, KE:{iso3:'KEN',ko:'케냐'}, TZ:{iso3:'TZA',ko:'탄자니아'},
  MZ:{iso3:'MOZ',ko:'모잠비크'}, MU:{iso3:'MUS',ko:'모리셔스'}, DJ:{iso3:'DJI',ko:'지부티'}, SD:{iso3:'SDN',ko:'수단'},
  AU:{iso3:'AUS',ko:'호주'}, NZ:{iso3:'NZL',ko:'뉴질랜드'}, PG:{iso3:'PNG',ko:'파푸아뉴기니'}, FJ:{iso3:'FJI',ko:'피지'},
};

// 항구명/LOCODE/별칭 → { c: ISO2, n: 표시명 }. 변형·약어 통합.
const PORTS = {
  // 한국
  BUSAN:{c:'KR',n:'부산'}, PUSAN:{c:'KR',n:'부산'}, KRPUS:{c:'KR',n:'부산'}, INCHEON:{c:'KR',n:'인천'}, KRINC:{c:'KR',n:'인천'},
  GWANGYANG:{c:'KR',n:'광양'}, KRKAN:{c:'KR',n:'광양'}, ULSAN:{c:'KR',n:'울산'}, KRUSN:{c:'KR',n:'울산'}, KRPTK:{c:'KR',n:'평택'},
  // 일본
  TOKYO:{c:'JP',n:'도쿄'}, JPTYO:{c:'JP',n:'도쿄'}, YOKOHAMA:{c:'JP',n:'요코하마'}, JPYOK:{c:'JP',n:'요코하마'},
  KOBE:{c:'JP',n:'고베'}, JPUKB:{c:'JP',n:'고베'}, NAGOYA:{c:'JP',n:'나고야'}, JPNGO:{c:'JP',n:'나고야'}, OSAKA:{c:'JP',n:'오사카'},
  JPOSA:{c:'JP',n:'오사카'}, CHIBA:{c:'JP',n:'치바'}, MOJI:{c:'JP',n:'모지'},
  // 중국
  SHANGHAI:{c:'CN',n:'상하이'}, CNSHA:{c:'CN',n:'상하이'}, NINGBO:{c:'CN',n:'닝보'}, CNNGB:{c:'CN',n:'닝보'},
  SHENZHEN:{c:'CN',n:'선전'}, CNSZN:{c:'CN',n:'선전'}, YANTIAN:{c:'CN',n:'옌톈'}, CNYTN:{c:'CN',n:'옌톈'},
  QINGDAO:{c:'CN',n:'칭다오'}, CNTAO:{c:'CN',n:'칭다오'}, TIANJIN:{c:'CN',n:'톈진'}, CNTSN:{c:'CN',n:'톈진'},
  XINGANG:{c:'CN',n:'톈진'}, GUANGZHOU:{c:'CN',n:'광저우'}, CNGGZ:{c:'CN',n:'광저우'}, NANSHA:{c:'CN',n:'광저우'},
  XIAMEN:{c:'CN',n:'샤먼'}, CNXMN:{c:'CN',n:'샤먼'}, DALIAN:{c:'CN',n:'다롄'}, CNDLC:{c:'CN',n:'다롄'},
  // 대만·홍콩·동남아
  KAOHSIUNG:{c:'TW',n:'가오슝'}, TWKHH:{c:'TW',n:'가오슝'}, KEELUNG:{c:'TW',n:'지룽'}, HONGKONG:{c:'HK',n:'홍콩'},
  HKHKG:{c:'HK',n:'홍콩'}, SINGAPORE:{c:'SG',n:'싱가포르'}, SGSIN:{c:'SG',n:'싱가포르'}, JURONG:{c:'SG',n:'싱가포르'},
  PORTKLANG:{c:'MY',n:'포트클랑'}, MYPKG:{c:'MY',n:'포트클랑'}, KLANG:{c:'MY',n:'포트클랑'}, TANJUNGPELEPAS:{c:'MY',n:'탄중펠레파스'},
  MYTPP:{c:'MY',n:'탄중펠레파스'}, PASIRGUDANG:{c:'MY',n:'파시르구당'}, JAKARTA:{c:'ID',n:'자카르타'}, IDJKT:{c:'ID',n:'자카르타'},
  TANJUNGPRIOK:{c:'ID',n:'자카르타'}, SURABAYA:{c:'ID',n:'수라바야'}, LAEMCHABANG:{c:'TH',n:'램차방'}, THLCH:{c:'TH',n:'램차방'},
  BANGKOK:{c:'TH',n:'방콕'}, THBKK:{c:'TH',n:'방콕'}, HOCHIMINH:{c:'VN',n:'호치민'}, VNSGN:{c:'VN',n:'호치민'},
  HAIPHONG:{c:'VN',n:'하이퐁'}, CAIMEP:{c:'VN',n:'까이맵'}, MANILA:{c:'PH',n:'마닐라'}, PHMNL:{c:'PH',n:'마닐라'},
  // 남아시아·중동
  COLOMBO:{c:'LK',n:'콜롬보'}, LKCMB:{c:'LK',n:'콜롬보'}, MUMBAI:{c:'IN',n:'뭄바이'}, INBOM:{c:'IN',n:'뭄바이'},
  NHAVASHEVA:{c:'IN',n:'나바셰바'}, INNSA:{c:'IN',n:'나바셰바'}, MUNDRA:{c:'IN',n:'문드라'}, INMUN:{c:'IN',n:'문드라'},
  CHENNAI:{c:'IN',n:'첸나이'}, INMAA:{c:'IN',n:'첸나이'}, DUBAI:{c:'AE',n:'두바이'}, JEBELALI:{c:'AE',n:'제벨알리'},
  AEJEA:{c:'AE',n:'제벨알리'}, AEDXB:{c:'AE',n:'두바이'}, ABUDHABI:{c:'AE',n:'아부다비'}, JEDDAH:{c:'SA',n:'제다'},
  SAJED:{c:'SA',n:'제다'}, DAMMAM:{c:'SA',n:'담맘'}, SADMM:{c:'SA',n:'담맘'}, HAMAD:{c:'QA',n:'하마드'}, QAHMD:{c:'QA',n:'하마드'},
  SOHAR:{c:'OM',n:'소하르'}, SALALAH:{c:'OM',n:'살랄라'}, OMSLL:{c:'OM',n:'살랄라'}, BANDARABBAS:{c:'IR',n:'반다르아바스'},
  PORTSAID:{c:'EG',n:'포트사이드'}, EGPSD:{c:'EG',n:'포트사이드'}, SUEZ:{c:'EG',n:'수에즈'}, EGSUZ:{c:'EG',n:'수에즈'},
  // 유럽 북부
  ROTTERDAM:{c:'NL',n:'로테르담'}, NLRTM:{c:'NL',n:'로테르담'}, AMSTERDAM:{c:'NL',n:'암스테르담'}, NLAMS:{c:'NL',n:'암스테르담'},
  IJMUIDEN:{c:'NL',n:'에이마위던'}, EEMSHAVEN:{c:'NL',n:'엠스하번'}, MOERDIJK:{c:'NL',n:'무르데이크'}, VLISSINGEN:{c:'NL',n:'플리싱언'},
  ANTWERP:{c:'BE',n:'안트베르펜'}, ANTWERPEN:{c:'BE',n:'안트베르펜'}, BEANR:{c:'BE',n:'안트베르펜'}, ZEEBRUGGE:{c:'BE',n:'제브뤼헤'},
  BEZEE:{c:'BE',n:'제브뤼헤'}, GENT:{c:'BE',n:'헨트'}, HAMBURG:{c:'DE',n:'함부르크'}, DEHAM:{c:'DE',n:'함부르크'},
  BREMEN:{c:'DE',n:'브레멘'}, BREMERHAVEN:{c:'DE',n:'브레머하펜'}, DEBRV:{c:'DE',n:'브레머하펜'}, WILHELMSHAVEN:{c:'DE',n:'빌헬름스하펜'},
  DEWVN:{c:'DE',n:'빌헬름스하펜'}, KIEL:{c:'DE',n:'킬'}, LEHAVRE:{c:'FR',n:'르아브르'}, FRLEH:{c:'FR',n:'르아브르'},
  MARSEILLE:{c:'FR',n:'마르세유'}, FRMRS:{c:'FR',n:'마르세유'}, DUNKIRK:{c:'FR',n:'됭케르크'}, DUNKERQUE:{c:'FR',n:'됭케르크'},
  FELIXSTOWE:{c:'GB',n:'펠릭스토'}, GBFXT:{c:'GB',n:'펠릭스토'}, SOUTHAMPTON:{c:'GB',n:'사우샘프턴'}, GBSOU:{c:'GB',n:'사우샘프턴'},
  LONDON:{c:'GB',n:'런던'}, GBLON:{c:'GB',n:'런던'}, LIVERPOOL:{c:'GB',n:'리버풀'}, TEESPORT:{c:'GB',n:'티스포트'}, GBTEE:{c:'GB',n:'티스포트'},
  GDANSK:{c:'PL',n:'그단스크'}, PLGDN:{c:'PL',n:'그단스크'}, GDYNIA:{c:'PL',n:'그디니아'}, PLGDY:{c:'PL',n:'그디니아'},
  // 유럽 남부
  VALENCIA:{c:'ES',n:'발렌시아'}, ESVLC:{c:'ES',n:'발렌시아'}, ALGECIRAS:{c:'ES',n:'알헤시라스'}, ESALG:{c:'ES',n:'알헤시라스'},
  BARCELONA:{c:'ES',n:'바르셀로나'}, ESBCN:{c:'ES',n:'바르셀로나'}, GENOA:{c:'IT',n:'제노바'}, GENOVA:{c:'IT',n:'제노바'},
  ITGOA:{c:'IT',n:'제노바'}, GIOIATAURO:{c:'IT',n:'조이아타우로'}, LASPEZIA:{c:'IT',n:'라스페치아'}, PIRAEUS:{c:'GR',n:'피레우스'},
  GRPIR:{c:'GR',n:'피레우스'}, THESSALONIKI:{c:'GR',n:'테살로니키'}, VALLETTA:{c:'MT',n:'몰타'}, MARSAXLOKK:{c:'MT',n:'몰타'},
  MTMLA:{c:'MT',n:'몰타'}, MTMAR:{c:'MT',n:'몰타'}, KOPER:{c:'SI',n:'코페르'}, RIJEKA:{c:'HR',n:'리예카'},
  // 스칸디나비아·발트
  HELSINKI:{c:'FI',n:'헬싱키'}, FIHEL:{c:'FI',n:'헬싱키'}, GOTHENBURG:{c:'SE',n:'예테보리'}, SEGOT:{c:'SE',n:'예테보리'},
  GOTEBORG:{c:'SE',n:'예테보리'}, BERGEN:{c:'NO',n:'베르겐'}, NOBGO:{c:'NO',n:'베르겐'}, OSLO:{c:'NO',n:'오슬로'},
  COPENHAGEN:{c:'DK',n:'코펜하겐'}, DKCPH:{c:'DK',n:'코펜하겐'}, AARHUS:{c:'DK',n:'오르후스'}, KLAIPEDA:{c:'LT',n:'클라이페다'},
  GDANSKBAY:{c:'PL',n:'그단스크'}, STPETERSBURG:{c:'RU',n:'상트페테르부르크'}, NOVOROSSIYSK:{c:'RU',n:'노보로시스크'},
  VLADIVOSTOK:{c:'RU',n:'블라디보스토크'}, RUVVO:{c:'RU',n:'블라디보스토크'},
  // 아메리카
  LOSANGELES:{c:'US',n:'로스앤젤레스'}, USLAX:{c:'US',n:'로스앤젤레스'}, LONGBEACH:{c:'US',n:'롱비치'}, USLGB:{c:'US',n:'롱비치'},
  NEWYORK:{c:'US',n:'뉴욕'}, USNYC:{c:'US',n:'뉴욕'}, SAVANNAH:{c:'US',n:'서배너'}, USSAV:{c:'US',n:'서배너'},
  HOUSTON:{c:'US',n:'휴스턴'}, USHOU:{c:'US',n:'휴스턴'}, CHARLESTON:{c:'US',n:'찰스턴'}, NORFOLK:{c:'US',n:'노퍽'},
  SEATTLE:{c:'US',n:'시애틀'}, OAKLAND:{c:'US',n:'오클랜드'}, VANCOUVER:{c:'CA',n:'밴쿠버'}, CAVAN:{c:'CA',n:'밴쿠버'},
  MONTREAL:{c:'CA',n:'몬트리올'}, SANTOS:{c:'BR',n:'산투스'}, BRSSZ:{c:'BR',n:'산투스'}, PARANAGUA:{c:'BR',n:'파라나과'},
  BUENOSAIRES:{c:'AR',n:'부에노스아이레스'}, MANZANILLO:{c:'MX',n:'만사니요'}, COLON:{c:'PA',n:'콜론'}, BALBOA:{c:'PA',n:'발보아'},
  PACRISTOBAL:{c:'PA',n:'크리스토발'}, CALLAO:{c:'PE',n:'카야오'}, SANANTONIO:{c:'CL',n:'산안토니오'}, CARTAGENA:{c:'CO',n:'카르타헤나'},
  // 아프리카·오세아니아
  DURBAN:{c:'ZA',n:'더반'}, ZADUR:{c:'ZA',n:'더반'}, CAPETOWN:{c:'ZA',n:'케이프타운'}, ZACPT:{c:'ZA',n:'케이프타운'},
  TANGERMED:{c:'MA',n:'탕헤르메드'}, MAPTM:{c:'MA',n:'탕헤르메드'}, CASABLANCA:{c:'MA',n:'카사블랑카'}, LAGOS:{c:'NG',n:'라고스'},
  MOMBASA:{c:'KE',n:'몸바사'}, TEMA:{c:'GH',n:'테마'}, ABIDJAN:{c:'CI',n:'아비장'}, PORTLOUIS:{c:'MU',n:'포트루이스'},
  SYDNEY:{c:'AU',n:'시드니'}, MELBOURNE:{c:'AU',n:'멜버른'}, AUMEL:{c:'AU',n:'멜버른'}, BRISBANE:{c:'AU',n:'브리즈번'},
  FREMANTLE:{c:'AU',n:'프리맨틀'}, AUFRE:{c:'AU',n:'프리맨틀'}, AUCKLAND:{c:'NZ',n:'오클랜드(NZ)'}, NZAKL:{c:'NZ',n:'오클랜드(NZ)'},

  // ── 군소·지역항 (실측 미식별 상위값 기반) ──
  // 네덜란드 내륙·연안
  HARLINGEN:{c:'NL',n:'하를링언'}, 'DEN HELDER':{c:'NL',n:'덴헬더르'}, DRACHTEN:{c:'NL',n:'드라흐턴'}, ALKMAAR:{c:'NL',n:'알크마르'},
  URK:{c:'NL',n:'위르크'}, WERKENDAM:{c:'NL',n:'베르켄담'}, NIJMEGEN:{c:'NL',n:'네이메헌'}, MEPPEL:{c:'NL',n:'메펄'},
  SCHEVENINGEN:{c:'NL',n:'스헤베닝언'}, MUIDEN:{c:'NL',n:'마위던'}, DORDRECHT:{c:'NL',n:'도르드레흐트'}, STELLENDAM:{c:'NL',n:'스텔런담'},
  EUROPOORT:{c:'NL',n:'외로포르트'}, OOSTERHOUT:{c:'NL',n:'오스테르하우트'}, ELBURG:{c:'NL',n:'엘뷔르흐'}, HAARLEM:{c:'NL',n:'하를럼'},
  HOORN:{c:'NL',n:'호른'}, ARNHEM:{c:'NL',n:'아른험'}, GRONINGEN:{c:'NL',n:'흐로닝언'}, ENKHUIZEN:{c:'NL',n:'엔크하위전'},
  LAUWERSOOG:{c:'NL',n:'라우에르소흐'}, BRESKENS:{c:'NL',n:'브레스컨스'}, MAASSLUIS:{c:'NL',n:'마슬라위스'}, TEXEL:{c:'NL',n:'텍설'},
  DELFZIJL:{c:'NL',n:'델프자일'}, TERNEUZEN:{c:'NL',n:'테르뇌전'}, AZIEHAVEN:{c:'NL',n:'암스테르담'}, MARGRIETHAVEN:{c:'NL',n:'테르뇌전'},
  IJSSELMEER:{c:'NL',n:'에이설호'}, WADDENZEE:{c:'NL',n:'바덴해'}, HANSWEERT:{c:'NL',n:'한스베르트'}, VEERE:{c:'NL',n:'페러'},
  // 벨기에
  OOSTENDE:{c:'BE',n:'오스텐더'}, OSTEND:{c:'BE',n:'오스텐더'}, ZELZATE:{c:'BE',n:'젤자터'}, NIEUWPOORT:{c:'BE',n:'니우포르트'},
  // 독일 내륙·연안
  BERLIN:{c:'DE',n:'베를린'}, ROSTOCK:{c:'DE',n:'로스토크'}, DUISBURG:{c:'DE',n:'뒤스부르크'}, PASSAU:{c:'DE',n:'파사우'},
  STADE:{c:'DE',n:'슈타데'}, BRUNSBUTTEL:{c:'DE',n:'브룬스뷔텔'}, EMDEN:{c:'DE',n:'엠덴'}, LUBECK:{c:'DE',n:'뤼베크'},
  MANNHEIM:{c:'DE',n:'만하임'}, MAGDEBURG:{c:'DE',n:'마그데부르크'}, KARLSRUHE:{c:'DE',n:'카를스루에'}, KEHL:{c:'DE',n:'켈'},
  // 노르웨이
  STAVANGER:{c:'NO',n:'스타방에르'}, TROMSO:{c:'NO',n:'트롬쇠'}, TROMSOE:{c:'NO',n:'트롬쇠'}, MONGSTAD:{c:'NO',n:'몽스타'},
  SANDNES:{c:'NO',n:'산네스'}, RORVIK:{c:'NO',n:'뢰르비크'}, LOVUND:{c:'NO',n:'로뷘'}, FREDRIKSTAD:{c:'NO',n:'프레드릭스타'},
  LONGYEARBYEN:{c:'NO',n:'롱위에아르뷔엔'}, KRISTIANSAND:{c:'NO',n:'크리스티안산'}, AALESUND:{c:'NO',n:'올레순'},
  HAUGESUND:{c:'NO',n:'헤우게순'}, BODO:{c:'NO',n:'보되'}, NARVIK:{c:'NO',n:'나르비크'},
  // 덴마크·발트
  SKAGEN:{c:'DK',n:'스카겐'}, ESBJERG:{c:'DK',n:'에스비에르'}, AALBORG:{c:'DK',n:'올보르'}, FREDERICIA:{c:'DK',n:'프레데리시아'},
  KALUNDBORG:{c:'DK',n:'칼룬보르'},
  // 영국·아일랜드
  ABERDEEN:{c:'GB',n:'애버딘'}, BLYTH:{c:'GB',n:'블라이스'}, IMMINGHAM:{c:'GB',n:'이밍엄'}, GRIMSBY:{c:'GB',n:'그림스비'},
  HULL:{c:'GB',n:'헐'}, PORTSMOUTH:{c:'GB',n:'포츠머스'}, DOUGLAS:{c:'IM',n:'더글러스'}, RINGASKIDDY:{c:'IE',n:'링개스키디'},
  // 프랑스·모나코
  ANTIBES:{c:'FR',n:'앙티브'}, 'ST TROPEZ':{c:'FR',n:'생트로페'}, BEAULIEU:{c:'FR',n:'볼리외'}, CANNES:{c:'FR',n:'칸'},
  NICE:{c:'FR',n:'니스'}, BORDEAUX:{c:'FR',n:'보르도'}, NANTES:{c:'FR',n:'낭트'}, ROUEN:{c:'FR',n:'루앙'},
  CALAIS:{c:'FR',n:'칼레'}, BREST:{c:'FR',n:'브레스트'}, TOULON:{c:'FR',n:'툴롱'}, SETE:{c:'FR',n:'세트'},
  MONACO:{c:'MC',n:'모나코'},
  // 이탈리아
  AUGUSTA:{c:'IT',n:'아우구스타'}, SIRACUSA:{c:'IT',n:'시라쿠사'}, LIVORNO:{c:'IT',n:'리보르노'}, NAPLES:{c:'IT',n:'나폴리'},
  NAPOLI:{c:'IT',n:'나폴리'}, SAVONA:{c:'IT',n:'사보나'}, TRIESTE:{c:'IT',n:'트리에스테'}, VENICE:{c:'IT',n:'베네치아'},
  VENEZIA:{c:'IT',n:'베네치아'}, RAVENNA:{c:'IT',n:'라벤나'}, BARI:{c:'IT',n:'바리'}, SALERNO:{c:'IT',n:'살레르노'},
  // 스페인
  'LAS PALMAS':{c:'ES',n:'라스팔마스'}, PALMA:{c:'ES',n:'팔마'}, 'PALMA DE MALLORCA':{c:'ES',n:'팔마'}, BILBAO:{c:'ES',n:'빌바오'},
  TARRAGONA:{c:'ES',n:'타라고나'}, VIGO:{c:'ES',n:'비고'}, MALAGA:{c:'ES',n:'말라가'}, SANTANDER:{c:'ES',n:'산탄데르'},
  // 그리스·지중해 동부
  SYROS:{c:'GR',n:'시로스'}, ATHENS:{c:'GR',n:'아테네'}, 'ATHENS MARINA':{c:'GR',n:'아테네'}, HERAKLION:{c:'GR',n:'이라클리오'},
  VOLOS:{c:'GR',n:'볼로스'}, PATRAS:{c:'GR',n:'파트라'}, LIMASSOL:{c:'CY',n:'리마솔'}, HAIFA:{c:'IL',n:'하이파'},
  ASHDOD:{c:'IL',n:'아슈도드'}, VARNA:{c:'BG',n:'바르나'}, BURGAS:{c:'BG',n:'부르가스'}, CONSTANTA:{c:'RO',n:'콘스탄차'},
  // 중부유럽 내륙
  BRATISLAVA:{c:'SK',n:'브라티슬라바'}, BASEL:{c:'CH',n:'바젤'},
  // 미국
  MIAMI:{c:'US',n:'마이애미'}, BALTIMORE:{c:'US',n:'볼티모어'}, BOSTON:{c:'US',n:'보스턴'}, TACOMA:{c:'US',n:'터코마'},
  'SAN DIEGO':{c:'US',n:'샌디에이고'}, 'FORT LAUDERDALE':{c:'US',n:'포트로더데일'}, PORTLAND:{c:'US',n:'포틀랜드'},
  BELLINGHAM:{c:'US',n:'벨링햄'}, BRUNSWICK:{c:'US',n:'브런즈윅'}, PHILADELPHIA:{c:'US',n:'필라델피아'}, MOBILE:{c:'US',n:'모빌'},
  GALVESTON:{c:'US',n:'갤버스턴'}, TAMPA:{c:'US',n:'탬파'}, JACKSONVILLE:{c:'US',n:'잭슨빌'}, EVERETT:{c:'US',n:'에버렛'},
  'NEW ORLEANS':{c:'US',n:'뉴올리언스'}, 'CORPUS CHRISTI':{c:'US',n:'코퍼스크리스티'}, 'BATON ROUGE':{c:'US',n:'배턴루지'},
  // 캐나다
  'CAMPBELL RIVER':{c:'CA',n:'캠벨리버'}, 'PRINCE RUPERT':{c:'CA',n:'프린스루퍼트'}, HALIFAX:{c:'CA',n:'핼리팩스'}, NANAIMO:{c:'CA',n:'나나이모'},
  // 호주
  BUNBURY:{c:'AU',n:'번버리'}, ADELAIDE:{c:'AU',n:'애들레이드'}, 'PORT HEDLAND':{c:'AU',n:'포트헤들랜드'}, GLADSTONE:{c:'AU',n:'글래드스턴'},
  DAMPIER:{c:'AU',n:'댐피어'}, TOWNSVILLE:{c:'AU',n:'타운즈빌'}, GEELONG:{c:'AU',n:'질롱'},
  // 동남아 추가
  PALEMBANG:{c:'ID',n:'팔렘방'},
};

// 국가명 단어 → ISO2 (LOCODE 휴리스틱보다 먼저 검사해 CHINA→스위스 같은 오분류 방지)
const COUNTRY_NAMES = {
  CHINA:'CN', KOREA:'KR', JAPAN:'JP', TAIWAN:'TW', VIETNAM:'VN', THAILAND:'TH', MALAYSIA:'MY',
  INDONESIA:'ID', PHILIPPINES:'PH', INDIA:'IN', PAKISTAN:'PK', BANGLADESH:'BD',
  ITALY:'IT', SPAIN:'ES', FRANCE:'FR', GERMANY:'DE', GREECE:'GR', TURKEY:'TR', RUSSIA:'RU',
  NORWAY:'NO', SWEDEN:'SE', FINLAND:'FI', DENMARK:'DK', POLAND:'PL', PORTUGAL:'PT', MALTA:'MT',
  CYPRUS:'CY', NETHERLANDS:'NL', BELGIUM:'BE', IRELAND:'IE', ICELAND:'IS', CROATIA:'HR',
  EGYPT:'EG', MOROCCO:'MA', NIGERIA:'NG', BRAZIL:'BR', MEXICO:'MX', CANADA:'CA', PANAMA:'PA',
  AUSTRALIA:'AU', ENGLAND:'GB', SCOTLAND:'GB', UK:'GB', USA:'US',
};

// 비항구(작업·미상) 키워드
const NONPORT = [
  'ORDER','FISHING','FISHFARM','FISH FARM','SAR','RESCUE','ANCHOR','AT SEA','HIGH SEA','OPEN SEA',
  'TBN','UNKNOWN','PILOT','BUNKER','OFFSHORE','DREDG','PATROL','SURVEY','RESEARCH','LOCAL','COASTAL',
  'ROADS','OPL','DRIFT','STANDBY','WAITING','NONE','TRANSIT','PASSAGE','MILITARY','WARSHIP','NAVY',
  'TUG','TOWING','SUPPLY','WIND FARM','WINDFARM','CABLE','DP ','LAYUP','LAY UP','SCRAP','RECYCL','NOWHERE','TEST',
  'RONDVAART','CRUISING','TOWAGE','NAAR BETER','SEA TRIAL','TRIAL','DREDGING','TRAINING','EXERCISE',
];

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function blank(raw, category) {
  return { raw, country: null, countryKo: null, port: null, category };
}

function normalizeDestination(raw) {
  if (!raw || typeof raw !== 'string') return blank(raw, 'none');
  let s = raw.toUpperCase().trim();
  // 경로형 "A>B", "A=>B", "A NAAR B"(네덜란드어 to): 최종 목적지(마지막 구간)만 취함
  if (/[>»]|=>/.test(s)) { const seg = s.split(/=>|[>»]+/).filter(Boolean); if (seg.length) s = seg[seg.length - 1].trim(); }
  if (/\sNAAR\s/.test(s)) { const seg = s.split(/\sNAAR\s/); s = seg[seg.length - 1].trim(); }
  s = s.replace(/^(FOR|TO|DEST(?:INATION)?|VIA|BOUND FOR)\s+/, '').trim();
  const clean = s.replace(/[^A-Z0-9 \-/]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 2 || /^\d+$/.test(clean)) return blank(raw, 'none');

  // 1) 비항구
  if (NONPORT.some(k => clean.includes(k))) return blank(raw, 'other');

  const compact = clean.replace(/[^A-Z0-9]/g, '');

  // 2) 사전 직접 매칭 (전체명 또는 LOCODE)
  let hit = PORTS[clean] || PORTS[compact];

  // 2.5) 국가명 단어 (LOCODE 휴리스틱보다 먼저 — CHINA→스위스 오분류 방지)
  if (!hit && COUNTRY_NAMES[clean]) {
    const iso2 = COUNTRY_NAMES[clean];
    return { raw, country: ISO2[iso2].iso3, countryKo: ISO2[iso2].ko, port: null, category: 'port' };
  }

  // 3) LOCODE 5자 (국가 추출)
  if (!hit && /^[A-Z]{2}[A-Z0-9]{3}$/.test(compact)) {
    const iso2 = compact.slice(0, 2);
    if (ISO2[iso2]) return { raw, country: ISO2[iso2].iso3, countryKo: ISO2[iso2].ko, port: null, category: 'port' };
  }

  // 4) 국가+약어 ("NL RTM") → 합쳐서 사전, 아니면 국가만
  if (!hit) {
    const tok = clean.split(/[ \-/]+/);
    if (tok[0]?.length === 2 && ISO2[tok[0]]) {
      hit = PORTS[tok.join('')];
      if (!hit) return { raw, country: ISO2[tok[0]].iso3, countryKo: ISO2[tok[0]].ko, port: null, category: 'port' };
    }
  }

  // 5) 항구명 다중단어 → 첫 토큰(4자+) 별칭
  if (!hit) {
    const first = clean.split(/[ \-/,]+/)[0];
    if (first && first.length >= 4) hit = PORTS[first];
  }

  // 6) 3자 ISO 코드 (SGP 등)
  if (!hit && /^[A-Z]{3}$/.test(compact)) {
    const k = Object.keys(ISO2).find(i => ISO2[i].iso3 === compact);
    if (k) return { raw, country: compact, countryKo: ISO2[k].ko, port: null, category: 'port' };
  }

  if (hit) {
    const c = ISO2[hit.c];
    return { raw, country: c?.iso3 ?? null, countryKo: c?.ko ?? null, port: hit.n, category: 'port' };
  }
  // 미식별 — 원문 표시명만 보존
  return { raw, country: null, countryKo: null, port: titleCase(clean), category: 'unknown' };
}

module.exports = { normalizeDestination };
