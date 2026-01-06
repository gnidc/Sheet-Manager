import { storage } from "../server/storage.js";

// Excel 데이터 (탭으로 구분) - 해외.액티브
const excelData = `Index	W	TIGER 토탈월드스탁액티브	0060H0	0.25%																								
에너지/인프라		TIGER 글로벌AI전력인프라 액티브	491010	0.49%					Mirae Asset AI Infrastructure 지수(Net Total Return)(원화환산)																			
		TIGER 글로벌AI액티브																										
NASDAQ		TIMEFOLIO 미국나스닥100액티브	426020	1.24%	-	2673억	-	-	NASDAQ100 Index	-	22.05	테슬라/엔비디아/마이크로스트래티지/알파벳/메타																
S&P500		TIMEFOLIO 미국S&P500액티브	426020	0.69%		1224억																						
DOW		TIMEFOLIO 미국배당다우존스액티브	0036D0	0.80%		110억								https://www.timefolio.co.kr/etf/funds_view.php?PID=21														
EMP		TIMEFOLIO 글로벌탑픽액티브	0113D0	0.06%		90억			Bloomberg World Large, Mid & Small Cap PR Index		25.10																	
AI	CN	TIMEFOLIO 차이나AI테크액티브	0043Y0	0.80%	-	259억					25.05	Tencent/Alibaba/Xiaomi/Zhejiang/BYD/SMIC/XPeng/TSMC																
우주/방산		TIMEFOLIO 글로벌우주테크&방산액티브	478150																									
		TIMEFOLIO 글로벌AI인공지능액티브																										
		TIMEFOLIO 글로벌바이오액티브																										
NASDAQ	US	KoAct 미국나스닥성장기업액티브	0015B0	0.50%	n/a	95억	n/a	n/a	Nasdaq100	n/a	25.02	팔란티어/브로드컴/알파벳		https://www.samsungactive.co.kr/etf/view.do?id=2ETFQ1	https://www.samsungactive.co.kr/insight/koactinsight/koactview-view.do?seqn=159													
바이오		KoAct 미국바이오헬스케어액티브	0113G0	0.50%																								
		KoAct 글로벌AI&로봇액티브																										
		KoAct 글로벌친환경전력인프라액티브																										
		KoAct AI인프라액티브																										
S&P500		KODEX 미국S&P500액티브	0041E0	0.45%		195억					25.04	S&P500 지수의 상위 100여개 종목에 '압축' 투자		https://www.samsungfund.com/etf/product/view.do?id=2ETFQ9														
금융		KODEX 미국금융테크액티브	0028X0	0.45%							25.05	쇼피파이/누홀딩스/뱅크오브뉴욕멜론/CME.G/VISA/BlackRock/Paypal		https://www.samsungfund.com/etf/product/view.do?id=2ETFQ6	https://www.samsungfund.com/etf/insight/newsroom/view.do?seqn=67254													
2205		CN	KODEX 차이나AI테크액티브	428510	0.50%		343억					22.05																	
A/M		ACE 글로벌자율주행액티브		0.62%	-	676억	-	-	FactSet US-China Electric&Autonomous Vehicle Index	-	22.02	테슬라/팔란티어/TSLL/알파벳/모빌아이																
AI		ACE 미국AI테크핵심산업액티브	0118Z0	0.45%		80억			Akros U.S. AI Innovator Price Return Index(원화환산)		25.10																	
		ACE 테슬라밸류체인액티브																										
		ACE 엔비디아밸류체인액티브																										
		ACE 구글밸류체인액티브																										
		ACE 애플밸류체인액티브																										
		ACE 마이크로소프트밸류체인액티브																										
25.11		ACE 미국대형성장주액티브					25.11																	
25.11		ACE 미국대형가치주액티브					25.11																	
Tech		 SOL 미국넥스트테크TOP10액티브	0118S0	0.55%																								
	CN	1Q 샤오미밸류체인액티브 	0094X0																									
3	P-AI		PLUS 글로벌휴머노이드로봇액티브	0035T0	0.45%										https://www.plusetf.co.kr/insight/report/detail?n=604														
P-AI		HANARO 글로벌피지컬AI액티브																										
AI		HANARO 글로벌생성형AI액티브		1.25%	-	310억	-	-	Solactive United States Technology 100 Index	-	23.07	팔란티어/엔비디아/앱러빈/브로드컴/TSMC																
		WON 반도체밸류체인액티브																										
		에셋플러스 차이나일등기업포커스10액티브																										
		에셋플러스 글로벌일등기업포커스10액티브																										
		RISE 미국AI테크액티브																									`;

async function addActiveEtfs() {
  console.log("Starting to add 해외.액티브 ETFs from Excel data...");
  
  // 기존 해외.액티브 데이터 확인
  const existingActiveEtfs = await storage.getEtfs({ mainCategory: "해외.액티브" });
  console.log(`Found ${existingActiveEtfs.length} existing 해외.액티브 ETFs.`);
  
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
    
    // 코드 형식 감지: 6자리 숫자 또는 영문+숫자 조합 (예: 0060H0, 428510, 0015B0)
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
    // 코드가 4번째 컬럼인 경우: 유형(0), 국가(1), 종목(2), 코드(3) 또는 유형(0), 국가(1), 종목(2), 코드(3)
    // 코드가 2번째 컬럼인 경우: 유형(0), 코드(1), ...
    
    if (codeIndex === 3) {
      // 일반적인 경우: 유형(0), 국가(1), 종목(2), 코드(3)
      subCategoryIndex = 0;
      countryIndex = 1;
      nameIndex = 2;
    } else if (codeIndex === 4) {
      // 코드가 4번째인 경우: 유형(0), [빈칸](1), 국가(2), 종목(3), 코드(4) 또는 유형(0), 국가(1), 종목(2), [기타](3), 코드(4)
      // 코드 앞의 컬럼들을 확인
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
    const existing = existingActiveEtfs.find(e => e.code === code);
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
      mainCategory: "해외.액티브",
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

addActiveEtfs()
  .then(() => {
    console.log("Adding 해외.액티브 ETFs completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Adding 해외.액티브 ETFs failed:", err);
    process.exit(1);
  });

