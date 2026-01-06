import { storage } from "../server/storage.js";

// Excel 데이터 (탭으로 구분) - 해외.패시브&기타
const excelData = `혼합형	미국	TIGER 미국나스닥100채권혼합Fn	435420	0.25%	1.30%	1764억	분기(4,7,10,12)	N/A	FnGuide 나스닥100 채권혼합지수(TR)	N/A	22.07	NASDAQ100(30%) vs 국내단기채권(70%) / Active ETF		https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7435420005	https://blog.naver.com/PostView.naver?blogId=m_invest&logNo=222790403508&categoryNo=42&parentCategoryNo=0&viewDate=&currentPage=3&postListTopCurrentPage=1&from=postList&userTopListOpen=true&userTopListCount=20&userTopListManageOpen=false&userTopListCurrentPage=3													
혼합형	미국	TIGER 미국테크TOP10채권혼합	472170	0.25%	1.90%	1685억	연(12월)	N/A																				
혼합형	미국	ACE글로벌인컴TOP10	460960	0.24%	8%(추정)	600억	월(말일)	N/A	Solactive Global Superior Income TOP 10 Price Return Index	N/A	23.07	커버드콜+고배당+하이일드채권 (주식형*5EA+채권형*5EA)		https://www.aceetf.co.kr/fund/K55101E30004														
혼합형/IRP100	미국	ACE 미국배당퀄리티채권혼합50	0049K0	0.15%	2.5%(추정)				Bloomberg WisdomTree U.S. Quality Dividend & Short Term KRW Bonds 50:50 TR Index		25.05			https://blog.naver.com/aceetf/223853842745														
혼합형	미국	ACE 미국S&P500채권혼합액티브	438080	0.15%	N/A	3288억	N/A	N/A	S&P500 and Short-Term Treasury 30/70 Blend Index	N/A	22.08	S&P500(30%) vs 미국단기채권(70%) / Active ETF		https://www.aceetf.co.kr/fund/K55101DU8887														
혼합형	미국	ACE 미국나스닥100미국채혼합50액티브	438100	0.15%	N/A	1991억	N/A	N/A	NASDAQ100 US T-Bills 30/70 Index	N/A	22.08	NASDAQ100(30%) vs 미국단기채권(70%) / Active ETF		https://www.aceetf.co.kr/fund/K55101DU8879														
혼합형/Active	미국	TIMEFOLIO 미국나스닥100채권혼합50액티브	0019K0	0.25%				N/A	FnGuide 미국나스닥100 단기채권혼합 지수	N/A	25.03	나스닥100(50%미만)+국내단기채(50%이상)																
혼합형	미국	SOL 미국TOP5채권혼합40 Solactive	447620	0.25%	0.06%	543억	연(5월)	N/A																				
혼합형	미국	SOL 미국배당미국채혼합50	490490	0.15%	3.50%	2447억	월(15일)	N/A	KRX 다우존스미국배당국채혼합지수(PR)	N/A	24.09	커버드콜 아님		https://www.soletf.com/ko/fund/etf/211068	https://www.hankyung.com/article/202409244352i													
혼합형/Active	미국	KoAct 미국 나스닥 채권혼합50 액티브	0104H0	0.25%								나스닥 25종목Active 선별)(50%) + 국내금융채(50%)																
혼합형	미국	PLUS 애플채권혼합	447660	0.25%	1.30%	196억	분기(2,5,8,11)	N/A																				
혼합형	미국	KIWOOM엔비디아미국30년국채혼합액티브(H)	0015E0	0.19%	TBD	100억	TBD	N/A				엔비디아와 미국 장기채에 3:7로 투자. 환헤지		https://www.kiwoometf.com/service/etf/KO02010200M?gcode=0015E0														
혼합형	미국	KIWOOM팔란티어미국30년국채혼합액티브(H)	0015F0	0.19%	TBD	100억	TBD	N/A				팔란티어와 미국 장기채에 3:7로 투자. 환헤지		https://www.kiwoometf.com/service/etf/KO02010200M?gcode=0015F0														
채권형	미국	KODEX iShares미국하이일드액티브	468380	0.15%	6.30%	467억	월지급(말일)	N/A	iShares Broad USD High Yield Corporate Bond ETF (USHY)	N/A	23.10	평균 Duration: 3.23년		https://www.samsungfund.com/etf/product/view.do?id=2ETFL2	https://www.samsungfund.com/etf/insight/newsroom/view.do?seq=56298													
채권형	미국	ACE 미국30년국채엔화노출액티브(H)	476750	0.15%	2.60%	1195억	월지급(말일)	N/A	Bloomberg US Treasury 20+ Year Total Return Index T1530 JPY Currency Hedged Index (원화환산)		24.03			https://www.aceetf.co.kr/fund/K55101E91790														
채권형	미국	RISE 미국30년국채엔화노출(합성 H)	472870	0.15%	2.80%	4211억	월지급(말일)	N/A	KIS 미국채 30년 엔화노출 지수(USD/JPY 헤지)(총수익 지수)		24.02			https://www.riseetf.co.kr/prod/finderDetail/44F9														
채권형	미국	 TIGER 미국초단기(3개월이하)국채	0046A0	0.09%			월지급(말일)							https://www.tigeretf.com/ko/insight/hot-etf-introduce/view.do?listCnt=6&pageIndex=1&detailsKey=545&q=	https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR70046A0008													
원자재/은		KODEX 은 선물(H)	A144600						S&P GSCI Silver Index(TR)		11.07																	
배당형	미국	KIWOOM 미국방어배당성장나스닥	373790	0.40%	1.40%	51억	월지급(말일)	N/A	Nasdaq US Low Volatility Dividend Achievers Index	N/A	20.12	최근 수익률 좋으나 배당수익률 낮고 '22~'23년 퍼포먼스 고려해보아야~		https://www.kiwoometf.com/service/etf/KO02010200M?gcode=373790	https://www.samsungfund.com/etf/insight/newsroom/view.do?seq=56298													
배당형	미국	ACE 미국배당퀄리티	0046Y0	0.15%					WisdomTree U.S. Quality Dividend Growth Index (Price Return)		25.05	미국 상장 주식 중 안정적인 배당을 지급하면서 성장성이 높은 종목에 투자하는 ETF		https://blog.naver.com/aceetf/223853842745														
해외/채권형	US	Kodex 미국달러SOFR금리 액티브(합성)	455030	0.15%		4585억					23.04																	
해외/채권형	US	TIGER 미국달러SOFR금리액티브(합성)	456610	0.05%		5571억					23.05																	
해외/채권형	US	ACE 미국달러SOFR금리(합성)	456880	0.05%							23.4		달러연동															
해외/채권형	US	TIGER 미국달러단기채권액티브	329750	0.30%	6%+환율						19.7	미국채(<1%),미상장국내채권(>90%)	달러연동	https://www.youtube.com/watch?v=fN3Rsjn4-G4&list=WL&index=1&ab_channel=%EC%A0%9C%EB%8F%84%EA%B6%8C%EC%A3%BC%EC%8B%9D%EB%B6%84%EC%84%9D														
해외/채권형	US	ACE 미국달러단기채권액티브	440650	0.30%	6%+환율						22.8	미국채(>30%),미상장국내채권(>70%)	달러연동															
25.12	S&P500		KIWOOM 미국S&P500모멘텀		0.12%							25.12			https://www.kiwoometf.com/service/invest/KO04020102T?kijaGubun=10&kijaNo=530&schGubun2=0&schGubun4=1&schContent=														
S/W	US	TIGER 글로벌클라우드컴퓨팅INDXX		0.64%	-	378억	-	-	Indxx Global Cloud Computing Index	-	20.12	트윌리오/스노우플레이크/쇼피파이/윅스닷컴/허브스팟																
	US	TIGER 미국AI소프트웨어TOP4Plus												https://investments.miraeasset.com/tigeretf/ko/insight/hot-etf-introduce/view.do?listCnt=8&pageIndex=1&detailsKey=592&q=														
2512		US	TIGER 미국 AI데이터센터 TOP4Plus	0142D0	0.49%										https://investments.miraeasset.com/tigeretf/ko/insight/etf-insight/view.do?detailsKey=617														
	CN	TIGER 차이나글로벌리더스TOP3+	0067V0	0.49%		639억					25.06			https://investments.miraeasset.com/tigeretf/ko/product/search/detail/index.do?ksdFund=KR70067V0007	https://investments.miraeasset.com/tigeretf/ko/insight/hot-etf-introduce/view.do?listCnt=6&pageIndex=1&detailsKey=560&q=													
	CN	TIGER 차이나테크TOP10	0047A0	0.49%		3040억																						
	CN	TIGER 차이나AI소프트웨어	0067Y0	0.49%		252억																						
P-AI	CN	TIGER 차이나휴머노이드로봇	0053L0	0.49%		4547억								https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR70053L0005	https://www.tigeretf.com/ko/insight/etf-insight/view.do?listCnt=6&pageIndex=1&detailsKey=552&q=													
2312			KODEX 미국서학개미	473460	0.25%		3831억		-	iSelect 서학개미 지수	-	23.12	테슬라/엔비디아/애플/마이크로소프트/알파벳																
2505	AI S/W	US	KODEX 미국AI소프트웨어TOP10	0041D0	0.45%							25.04	팔란티어,MS,세일즈포스,서비스나우,스노우플레이크,팔로알토, etc		https://www.samsungfund.com/etf/product/view.do?id=2ETFQ4														
P-AI	US	KODEX 미국휴머노이드로봇	0038A0	0.45%										https://www.samsungfund.com/etf/product/view.do?id=2ETFQ8	https://www.samsungfund.com/etf/insight/newsroom/view.do?seqn=66537													
1611		CN	KODEX 차이나심천ChiNext(합성)	256750	0.47%		457억																						
	CN	KODEX 차이나테크TOP10	0065G0	0.45%		484억																						
	CN	KODEX 차이나휴머노이드로봇	0048K0	0.45%		2675억																						
2511	에너지/인프라	US	KODEX 미국원자력 SMR	0132H0	0.45%					iSelect 미국원자력 SMR 지수		25.11	10종목																
AI S/W	US	SOL 미국AI소프트웨어	481180	0.45%					KEDI 미국양자컴퓨팅TOP10지수(PR)(원화환산)																			
2505	에너지/인프라	US	SOL 미국원자력SMR									25.05																	
양자컴퓨팅	US	SOL 미국양자컴퓨팅TOP10	0023A0	0.45%	-	128억	연 1회	n/a			25.03			https://www.soletf.com/ko/fund/etf/211084														
Quality	US	ACE 미국WideMoat동일가중	309230	0.40%	4~5%	1422억	분기(2,5,8,11월초)	n/a	Morningstar Wide Moat Focus Price Return Index	n/a	18.10	GILEAD SCIENCES/ALTRIA/AGILENT/CORTEVA/WALT DISNEY		https://www.aceetf.co.kr/fund/K55101CF3110														
M7	US	ACE미국빅테크TOP7PLUS(&레버리지)		0.30%	n/a	6777억	n/a	n/a			23.09	아마존/구글/엔비디아/마이크로소프트/애플/브로드컴/메타/테슬라/넷플릭스/AMD																
		ACE 테슬라밸류체인액티브	457480	0.29%		1조3736억																						
Quality	US	RISE 버크셔포트폴리오TOP10																										
1	P-AI	US	RISE 미국휴머노이드로봇	0036R0	0.40%							25.04	ISRG/AUR/NVDA/TSLA/ROK																
25.11	클라우드/인프라	US	RISE 미국 AI 클라우드인프라	0127R0	0.40%							25.11	10종목																
		RISE 테슬라고정테크100	0047P0	0.20%		189억																						
		RISE 팔란티어고정테크100	0047R0	0.20%		393억																						
Quality	US	WON 미국빌리어네어		0.62%	-	238억	-	-	Bloomberg US Billionaires Investment Select Price Return Index	-	24.09	브로드컴/테슬라/알파벳/아마존/월마트																
양자컴퓨팅	US	KIWOOM 미국양자컴퓨팅	498270	0.49%					Solactive US Quantum Computing Index																			
25.11	Tech	US	1Q 미국우주항공테크	0131V0 	0.49%	-	668억			Akros 미국우주항공테크지수		25.11	12종목																
		PLUS 글로벌HBM반도체																										
파생/혼합		KIWOOM 미국테크100월간목표헤지액티브									25.07	Protective Put																
파생/혼합		KIWOOM 미국대형주500월간목표헤지액티브	0084E0	0.49%							25.10	Protective Put																
		KIWOOM 한국고배당&미국AI테크	0097L0																									
		KIWOOM 미국고배당&AI테크		0.45																									`;

async function addPassiveEtfs() {
  console.log("Starting to add 해외.패시브&기타 ETFs from Excel data...");
  
  // 기존 해외.패시브&기타 데이터 확인
  const existingPassiveEtfs = await storage.getEtfs({ mainCategory: "해외.패시브&기타" });
  console.log(`Found ${existingPassiveEtfs.length} existing 해외.패시브&기타 ETFs.`);
  
  // 새 데이터 파싱 및 삽입
  const lines = excelData.split("\n").filter(l => l.trim() !== "");
  console.log(`Parsing ${lines.length} lines from Excel data...`);
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (const line of lines) {
    const parts = line.split("\t").map(p => p.trim());
    
    // 빈 줄 건너뛰기
    if (parts.length === 0 || parts.every(p => !p)) {
      continue;
    }
    
    // 코드 형식 감지: 6자리 숫자 또는 영문+숫자 조합 (예: 0060H0, 428510, 0015B0, A144600)
    const codePattern = /^[0-9A-Z]{6}$/;
    
    // 코드 위치 찾기 (일반적으로 3번째 또는 4번째 컬럼)
    let codeIndex = -1;
    let nameIndex = -1;
    let countryIndex = -1;
    let subCategoryIndex = 0;
    
    // 코드 위치 찾기
    for (let i = 0; i < Math.min(parts.length, 6); i++) {
      if (codePattern.test(parts[i])) {
        codeIndex = i;
        break;
      }
    }
    
    if (codeIndex === -1) {
      // 코드를 찾을 수 없으면 스킵
      skippedCount++;
      console.warn(`Skipping line - code not found: ${line.substring(0, 50)}...`);
      continue;
    }
    
    // 코드가 3번째 컬럼인 경우: 유형(0), 국가(1), 종목(2), 코드(3)
    // 코드가 4번째 컬럼인 경우: 유형(0), 국가(1), 종목(2), 코드(3) 또는 유형(0), 국가(1), 종목(2), [기타](3), 코드(4)
    // 코드가 2번째 컬럼인 경우: 유형(0), 코드(1), ...
    
    if (codeIndex === 3) {
      // 일반적인 경우: 유형(0), 국가(1), 종목(2), 코드(3)
      subCategoryIndex = 0;
      countryIndex = 1;
      nameIndex = 2;
    } else if (codeIndex === 4) {
      // 코드가 4번째인 경우: 유형(0), 국가(1), 종목(2), 코드(3) 또는 다른 구조
      // 실제로는 코드 앞의 컬럼들을 확인
      if (parts[1] && parts[1].length <= 3 && (parts[1] === "US" || parts[1] === "CN" || parts[1] === "W")) {
        // 국가가 1번째인 경우: 유형(0), 국가(1), 종목(2), [기타](3), 코드(4)
        subCategoryIndex = 0;
        countryIndex = 1;
        nameIndex = 2;
      } else {
        // 국가가 2번째인 경우: 유형(0), [빈칸](1), 국가(2), 종목(3), 코드(4)
        subCategoryIndex = 0;
        countryIndex = 2;
        nameIndex = 3;
      }
    } else if (codeIndex === 2) {
      // 코드가 2번째인 경우: 유형(0), 코드(1), 종목(2) 또는 다른 구조
      subCategoryIndex = 0;
      countryIndex = -1;
      nameIndex = codeIndex + 1;
    } else {
      // 다른 경우: 코드 앞의 컬럼들을 확인
      subCategoryIndex = 0;
      countryIndex = codeIndex > 1 ? 1 : -1;
      nameIndex = codeIndex > 0 ? codeIndex - 1 : -1;
    }
    
    const subCategory = subCategoryIndex >= 0 ? (parts[subCategoryIndex] || null) : null;
    const country = countryIndex >= 0 ? (parts[countryIndex] || null) : null;
    const name = nameIndex >= 0 ? (parts[nameIndex] || null) : null;
    const code = parts[codeIndex] || null;
    
    // name과 code는 필수
    if (!name || !code) {
      skippedCount++;
      console.warn(`Skipping line with missing name or code. name: "${name}", code: "${code}"`);
      continue;
    }
    
    // 이미 존재하는지 확인 (코드로)
    const existing = existingPassiveEtfs.find(e => e.code === code);
    if (existing) {
      // 기존 데이터가 잘못 저장된 경우 업데이트
      if (existing.name !== name || existing.country !== country || existing.subCategory !== subCategory) {
        try {
          await storage.updateEtf(existing.id, {
            name: name,
            country: country,
            subCategory: subCategory,
          });
          console.log(`↻ Updated: ${name} (${code})`);
          successCount++;
        } catch (e: any) {
          errorCount++;
          console.error(`✗ Error updating ${name} (${code}):`, e.message);
        }
      } else {
        skippedCount++;
        console.log(`⊘ Skipping existing ETF: ${name} (${code})`);
      }
      continue;
    }
    
    // 코드 이후의 필드 인덱스 계산
    // 일반적인 구조: 코드(3), 운용수수료(4), 배당(분배)율(5), 시가총액(6), 배당주기(7), 옵션유형(8), 기초자산(9), 매도옵션(10), 상장(11), 기타(12), ROC(13), 링크들(14, 15)
    const offset = codeIndex - 3; // 코드가 3번째가 아닌 경우 오프셋 계산
    
    const feeIndex = 4 + offset;
    const yieldIndex = 5 + offset;
    const marketCapIndex = 6 + offset;
    const dividendCycleIndex = 7 + offset;
    const optionTypeIndex = 8 + offset;
    const underlyingAssetIndex = 9 + offset;
    const callOptionIndex = 10 + offset;
    const listingDateIndex = 11 + offset;
    const notesIndex = 12 + offset;
    const rocIndex = 13 + offset;
    const linkProductIndex = 14 + offset;
    const linkBlogIndex = 15 + offset;
    
    // ROC를 notes에 포함
    const roc = parts[rocIndex]?.trim() || "";
    const notesBase = parts[notesIndex]?.trim() || "";
    const notes = roc ? (notesBase ? `${notesBase} | ROC: ${roc}` : `ROC: ${roc}`) : notesBase;
    
    const etfData = {
      generation: null,
      mainCategory: "해외.패시브&기타",
      subCategory: subCategory,
      country: country,
      name: name,
      code: code,
      fee: parts[feeIndex] || null, // 운용수수료
      yield: parts[yieldIndex] || null, // 배당(분배)율
      marketCap: parts[marketCapIndex] || null, // 시가총액/일평균거래액
      dividendCycle: parts[dividendCycleIndex] || null, // 배당주기(배당일)
      optionType: parts[optionTypeIndex] || null, // 옵션유형(매도비율)
      underlyingAsset: parts[underlyingAssetIndex] || null, // 기초자산
      callOption: parts[callOptionIndex] || null, // 매도옵션
      listingDate: parts[listingDateIndex] || null, // 상장
      notes: notes || null, // 기타(특징) + ROC
      linkProduct: parts[linkProductIndex]?.trim() || null,
      linkBlog: parts[linkBlogIndex]?.trim() || null,
    };
    
    try {
      await storage.createEtf(etfData);
      successCount++;
      console.log(`✓ Created: ${name} (${code})`);
    } catch (e: any) {
      errorCount++;
      console.error(`✗ Error creating ${name} (${code}):`, e.message);
    }
  }
  
  console.log(`\n=== Add Complete ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Skipped (existing or invalid): ${skippedCount}`);
  console.log(`Total lines processed: ${lines.length}`);
}

addPassiveEtfs()
  .then(() => {
    console.log("Adding 해외.패시브&기타 ETFs completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Adding 해외.패시브&기타 ETFs failed:", err);
    process.exit(1);
  });

