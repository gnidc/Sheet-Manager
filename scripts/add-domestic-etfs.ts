import { storage } from "../server/storage.js";

// Excel 데이터 (탭으로 구분) - 국내자산
const excelData = `국내배당	PLUS 고배당주위클리커버드콜	489030	0.30%	14.40%	385억/10~30억	Mon(말일)	Weekly	코스피고배당위클리커버드콜 ATM 지수	KOSPI200	24.08	"비과세 옵션프리미엄 절세혜택
프리미엄50%분배/50%재투자"	95%	https://www.plusetf.co.kr/insight/report/detail?n=261	https://www.plusetf.co.kr/product/detail?n=006370													
	PLUS 고배당주위클리고정커버드콜	0018C0																									
2	국내배당	TIGER 은행고배당플러스TOP10	466940	0.30%	6~7%	2998억	Mon(말일)	N/A	FnGuide 은행고배당플러스TOP10지수	N/A	23.10																	
2509		TIGER 코리아배당다우존스위클리커버드콜	0104P0																									
2312		TIGER 배당커버드콜액티브	472150	0.50%	15~23%	2485억			코스피200 커버드콜 5% OTM 지수		2312			https://blog.naver.com/PostView.naver?blogId=m_invest&logNo=223279885908&categoryNo=42&parentCategoryNo=0&viewDate=&currentPage=1&postListTopCurrentPage=&from=menu&userTopListOpen=true&userTopListCount=5&userTopListManageOpen=false&userTopListCurrentPage=1														
국내배당	KODEX 금융고배당TOP10타겟위클리커버드콜	498410	0.39%	15%	294억	Mon(말일)	Weekly(30%)	금융고배당TOP10 TR	KOSPI200/ATM	24.12	"주식배당(7%),옵션프리미엄(10%)
->15% 추가재원은 적립"		https://www.samsungfund.com/etf/product/view.do?id=2ETFP1	https://www.samsungfund.com/etf/insight/newsroom/view.do?seqn=64155													
1	국내배당	TIMEFOLIO Korea플러스배당액티브	441800	0.80%	10%+	1627억	Mon(말일)	N/A	코스피 200	N/A	22.09																	
국내배당	RISE 코리아 금융 고배당	498860	0.10%	6~7%	59억	Mon(15일)	N/A	"iSelect 코리아금융고배당 지수	"	N/A	24.12			https://www.riseetf.co.kr/prod/finderDetail/44H8														
1802	국내배당	RISE 200고배당커버드콜ATM	290080	0.40%	8%	108억	Mon(말일)	Monthly	코스피 200 고배당 커버드콜 ATM	KOSPI200	18.02	최근 1년 수익률 좋음		https://www.riseetf.co.kr/prod/finderDetail/4478														
2509	KOSPI200	TIGER 200타겟위클리커버드콜	0104N0	0.25%	7%	461억			코스피 200 타겟 7% 위클리 커버드콜 지수																			
1802	KOSPI200	TIGER 200커버드콜	289480																									
1210	KOSPI200	TIGER 200커버드콜OTM	166400																									
KOSPI200	RISE200위클리커버드콜	475720	0.30%	18%(추정)	4729억	Mon(말일)	Weekly*2회	코스피 200 위클리 커버드콜 ATM 지수	종목옵션 ATM	24.03	시가총액 높으나 수익률 좋지 않음	90%+															
2509	SECTOR	RISE 코리아밸류업위클리고정커버드콜	0094M0	0.30%	15%(추정)	100억		Weekly*2회	코스피 200 위클리 커버드콜 ATM 지수	종목옵션 ATM	25.09	지수:커버드콜 7:3으로 투자/ATM사용		https://www.riseetf.co.kr/prod/finderDetail/44J2														
2	KOSPI200	KODEX 200타겟위클리커버드콜	498400	0.39%	15%	291억/70억+	Mon(15일)	Weekly	KOSPI200	KOSPI200	24.12			https://www.samsungfund.com/etf/insight/newsroom/view.do?seqn=63913	https://www.samsungfund.com/etf/product/view.do?id=2ETFP4													
국내채권	TIGER CD금리플러스액티브(합성)	499660	0.0098%	CD금리+알파		Mon(말일)	N/A	CD91일물	N/A	24.12	CD91월물+알파(0.1%)		https://m.blog.naver.com/m_invest/223691210565														
국내채권	TIGER CD금리투자KIS(합성)																										
국내채권	KODEX CD금리액티브(합성)																										
국내채권	KODEX KOFR 금리액티브(합성)	423160	0.05%		4.34조					22.04																	
국내채권	TIGER KOFR 금리액티브(합성)		0.03%		3.5조																						
	TIGER 머니마켓액티브 																										
국내채권	KODEX 머니마켓액티브	488770																									
1907	리츠	TIGER 리츠부동산인프라	329200	0.08%	>9%	6580억	Mon				19.7			https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7329200000														
2507	리츠(분리과세)	TIGER 리츠부동산인프라TOP10액티브	0086B0	0.06%	6~7%	1028억	Mon(15일)				25.07	5천만원 한도/ 9.9% 분리과세 신청가능		https://www.tigeretf.com/ko/insight/etf-insight/view.do?listCnt=6&pageIndex=1&detailsKey=571&q=														
2403	리츠(분리과세)	KODEX 한국부동산리츠인프라	476800	0.09%	>9%	3509억	Mon				24.03			https://www.samsungfund.com/etf/product/view.do?id=2ETFM4														
국내섹터	Kodex K방산TOP10	0080G0	0.45%							25.07			https://samsungfundblog.com/archives/52513														
국내배당	TIGER 코리아배당다우존스	0052D0	0.25%	4.7%?	4190억	Mon(15일)		Dow Jones Korea Dividend 30 지수 (Price Return)		25.05	한국형 SCHD		https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR70052D0006														
국내배당	PLUS 고배당주	161510	0.23%	5.10%	1.5조			FnGuide 배당주 지수		12.08																	
국내배당	TIGER 은행고배당플러스 TOP10	466940	0.30%	5.70%	6900억			FnGuide 은행고배당플러스 TOP10 지수(시장가격 지수)		23.10																	
국내배당	KODEX 금융고배당 TOP10	0089D0		6%						25.08																	
국내배당	KODEX 고배당주	279530	0.30%	5.50%	2658억			FnGuide 고배당 Plus 지수		17.10																	
국내배당	SOL 금융지주플러스고배당	484880	0.30%	5.50%	2224억			FnGuide 금융지주플러스고배당 지수(PR)		24.06																	
국내배당	RISE 코리아금융고배당	498860	0.10%		757억			iSelect 코리아 금융 고배당 지수		24.12																	
국내섹터	KODEX 로봇액티브	445290	0.50%	<1%	1643억	연배당(4월)		iSelect K-로봇테마 지수		22.11			https://www.samsungfund.com/etf/product/view.do?id=2ETFH5														
	KODEX 200액티브	494890	0.15%		5929억																						
	KODEX 친환경조선해운액티브																										
	TIGER 코리아테크액티브	471780	0.77%		304억																						
2601		TIGER 코리아휴머노이드로봇산업	0148J0	0.50%							2601			https://investments.miraeasset.com/tigeretf/ko/insight/etf-insight/view.do?detailsKey=624														
	TIMEFOLIO 코스피액티브	385720	0.80%																								
	TIMEFOLIO 코리아밸류업액티브	495060	0.80%																								
	TIMEFOLIO K바이오액티브	463050	0.80%																								
	에셋플러스 코리아대장장이액티브																										
2210		SOL 코리아메가테크액티브	444200	0.55%		3532억					2210	25년 수익률 115.9%		https://www.soletf.com/ko/fund/etf/210940?tabIndex=3														
	FOCUS AI코리아액티브																										
	1Q K200액티브																										
	KoAct 바이오헬스케어액티브																										
	KoAct 배당성장액티브																										
2512		RISE 동학개미	0138D0	0.07%							2512			https://www.riseetf.co.kr/prod/finderDetail/44J8													`;

async function addDomesticEtfs() {
  console.log("Starting to add 국내자산 ETFs from Excel data...");
  
  // 기존 국내자산 데이터 확인
  const existingDomesticEtfs = await storage.getEtfs({ mainCategory: "국내자산" });
  console.log(`Found ${existingDomesticEtfs.length} existing 국내자산 ETFs.`);
  
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
    
    // 코드 형식 감지: 6자리 숫자 또는 영문+숫자 조합 (예: 489030, 0018C0, 466940)
    const codePattern = /^[0-9A-Z]{6}$/;
    
    // 코드 위치 찾기 (일반적으로 2번째 또는 3번째 컬럼)
    let codeIndex = -1;
    let nameIndex = -1;
    let subCategoryIndex = 0;
    
    // 코드 위치 찾기
    for (let i = 0; i < Math.min(parts.length, 5); i++) {
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
    
    // 국내자산 데이터 구조: 유형(0), 종목(1), 코드(2) 또는 [날짜](0), 유형(1), 종목(2), 코드(3)
    if (codeIndex === 2) {
      // 일반적인 경우: 유형(0), 종목(1), 코드(2)
      subCategoryIndex = 0;
      nameIndex = 1;
    } else if (codeIndex === 3) {
      // 날짜가 첫 번째인 경우: [날짜](0), 유형(1), 종목(2), 코드(3)
      subCategoryIndex = 1;
      nameIndex = 2;
    } else if (codeIndex === 1) {
      // 유형이 없는 경우: 종목(0), 코드(1)
      subCategoryIndex = -1;
      nameIndex = 0;
    } else {
      // 다른 경우
      subCategoryIndex = codeIndex > 1 ? codeIndex - 2 : -1;
      nameIndex = codeIndex > 0 ? codeIndex - 1 : -1;
    }
    
    const subCategory = subCategoryIndex >= 0 ? (parts[subCategoryIndex] || null) : null;
    const name = nameIndex >= 0 ? (parts[nameIndex] || null) : null;
    const code = parts[codeIndex] || null;
    
    // name과 code는 필수
    if (!name || !code) {
      skippedCount++;
      console.warn(`Skipping line with missing name or code. name: "${name}", code: "${code}"`);
      continue;
    }
    
    // 이미 존재하는지 확인 (코드로)
    const existing = existingDomesticEtfs.find(e => e.code === code);
    if (existing) {
      // 기존 데이터가 잘못 저장된 경우 업데이트
      if (existing.name !== name || existing.subCategory !== subCategory) {
        try {
          await storage.updateEtf(existing.id, {
            name: name,
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
    // 일반적인 구조: 코드(2), 운용수수료(3), 배당(분배)율(4), 시가총액(5), 배당주기(6), 옵션유형(7), 기초자산(8), 매도옵션(9), 상장(10), 기타(11), ROC(12), 링크들(13, 14)
    const offset = codeIndex - 2; // 코드가 2번째가 아닌 경우 오프셋 계산
    
    const feeIndex = 3 + offset;
    const yieldIndex = 4 + offset;
    const marketCapIndex = 5 + offset;
    const dividendCycleIndex = 6 + offset;
    const optionTypeIndex = 7 + offset;
    const underlyingAssetIndex = 8 + offset;
    const callOptionIndex = 9 + offset;
    const listingDateIndex = 10 + offset;
    const notesIndex = 11 + offset;
    const rocIndex = 12 + offset;
    const linkProductIndex = 13 + offset;
    const linkBlogIndex = 14 + offset;
    
    // ROC를 notes에 포함
    const roc = parts[rocIndex]?.trim() || "";
    const notesBase = parts[notesIndex]?.trim() || "";
    const notes = roc ? (notesBase ? `${notesBase} | ROC: ${roc}` : `ROC: ${roc}`) : notesBase;
    
    const etfData = {
      generation: null,
      mainCategory: "국내자산",
      subCategory: subCategory,
      country: null, // 국내자산이므로 국가는 null
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

addDomesticEtfs()
  .then(() => {
    console.log("Adding 국내자산 ETFs completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Adding 국내자산 ETFs failed:", err);
    process.exit(1);
  });

