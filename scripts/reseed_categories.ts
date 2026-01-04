import { storage } from "../server/storage";

const data = `미국국채	미국	TIGER 미국30년국채커버드콜액티브(H)	476550	0.39%	12%(타겟)	1.1조/>100억	월지급(말일)	위클리(30%)	KEDI US Treasury 30Y Weekly Covered Call 30 Index	TLT	24.02	환헷지	0~100%	https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7476550009	https://blog.naver.com/m_invest/223358405892		
미국국채	미국	KODEX 미국30년국채타겟커버드콜(합성 H)	481060	0.25%	12%(타겟)	4142억/50~150억	월지급(15일)	위클리(30%)	Bloomberg U.S.Treasury 20+ Year(TLT)+ 12% Premium Covered Call index(Total Return)	TLT	24.04	환헷지/옵션매도비중조절	0~15%	https://www.samsungfund.com/etf/product/view.do?id=2ETFM9			
미국국채	미국	RISE 미국30년국채커버드콜(합성)	472830	0.25%	12%(타겟)	316억/1~3억	월지급(말일)	위클리(30%)	Bloomberg U.S. Treasury 20+ Year(TLT) 2% OTM Covered Call Index	TLT	23.12	환노출/실제 배당액은 11%미만임('24.11월 현재)	최근 0%	https://www.riseetf.co.kr/prod/finderDetail/44F8			
미국국채	미국	SOL 미국30년국채커버드콜(합성)	473330	0.25%	12%(타겟)	1944억/10~50억	월지급(말일)	위클리(30%)	KEDI 미국국채20년+ 커버드콜지수(NTR)	TLT	23.12	환노출/실제 배당액은 12%정도('24.11월 현재)	0%	https://www.soletf.com/ko/fund/etf/211044			
나스닥100	미국	TIGER 미국나스닥100커버드콜(합성)	441680	0.37%	12%(타겟)	3557억/10~50억	월지급(말일)	Monthly타겟(~100%)	CBOE Nasdaq-100 BuyWrite V2 지수(Total Return)(원화환산)	ATM Nasdaq-100 콜옵션	22.09			https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7441680006			
나스닥100	미국	TIGER 미국나스닥100타겟데일리커버드콜	486290	0.25%	15%(타겟)	5092억/50~150억	월지급(말일)	데일리타겟(15%+-)	NASDAQ-100 Daily Covered Call Target Premium 15% 지수(Total Return)(원화환산)	NASDAQ100 콜옵션	24.06			https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7486290000	https://blog.naver.com/m_invest/223487037728?trackingCode=blog_bloghome_searchlist		
나스닥100	미국	KODEX 미국나스닥100데일리커버드콜OTM	494300	0.25%	Max.20%	955억/30~100억	월지급(말일)	데일리(~100%)	NASDAQ-100 Daily Covered Call 101 Index(Total Return)	NASDAQ100 1% OTM Daily Option	24.10	나스닥100 상승 1% 추종/실물옵션 매매/추가 프리미엄은 재투자	0%	https://www.samsungfund.com/etf/insight/newsroom/view.do?seq=63073	https://www.samsungfund.com/etf/product/view.do?id=2ETFO6		
S&P500	미국	TIGER 미국S&P500타겟데일리커버드콜	482730	0.25%	10%(타겟)	1752억/10~30억	월지급(말일)	데일리타겟(10%+-)	S&P 500 10% Daily Premium Covered Call 지수(원화환산)	S&P500 ATM 옵션	24.05	10%프리미엄타겟 매도비중 조절		https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7482730009	https://www.tigeretf.com/upload/etf/20241108090244009079.pdf		
S&P500	미국	SOL 미국500타겟커버드콜액티브	494210	0.35%	12%(타겟)	80억/10~15억	월지급(말일)	데일리타겟(10%+-)	KEDI 미국퀄리티 500+월1%프리미엄지수(NTR)	미국 대형주 ETF중 시가총액이 가장 큰 ETF	24.10	Active운용/옵션매도비중조절		https://www.soletf.com/ko/fund/etf/211064			
S&P500	미국	ACE 미국500데일리타겟커버드콜(합성)	480030	0.45%	15%(타겟)	1026억/10~30억	월지급(15일)	데일리타겟	Bloomberg US 500 Large Cap Premium Decrement 15% Distribution Index	SPY OTM 0.7% Option	24.04	S&P500의 일일 0.7%만 지수추종		https://www.aceetf.co.kr/fund/K55101E97755			
S&P500	미국	KODEX 미국S&P500 데일리 커버드콜 OTM	0005A0	0.25%	15%(타겟)	1035억	월지급(말일)	데일리타겟	S&P500 1% OTM 지수	SPY OTM 1% Option	25.01	S&P500의 일일 1%까지 지수추종		https://www.samsungfund.com/etf/insight/newsroom/view.do?seq=64514	https://www.samsungfund.com/etf/product/view.do?id=2ETFP5		
AI테크	미국	KODEX 미국AI테크TOP10타겟커버드콜	483280	0.39%	15%(타겟)	3333억/30~100억	월지급(말일)	위클리타겟(24.5%)	KEDI 미국AI테크TOP10+15%프리미엄 지수(Total Return)	NASDAQ100 Option	24.05	AI 투자방식(시가총액 + LLM모델)로 AI 관련주 선별, 직접운용		https://www.samsungfund.com/etf/product/view.do?id=2ETFN2			
AI테크	미국	TIGER 미국AI빅테크10타겟데일리커버드콜	493810	0.25%	15%(타겟)	1013억/30~100억	월지급(15일)	데일리타겟	KEDI 미국AI빅테크10+15%데일리프리미엄 지수(TR)(원화환산)	NASDAQ100 ATM 콜옵션	24.10	수익성과 성장성을 고려한 AI 투자 + 월배당		https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7493810006	https://www.tigeretf.com/ko/insight/hot-etf-introduce/view.do?listCnt=6&pageIndex=2&detailsKey=499&q=		
AI테크	미국	RISE 미국AI밸류체인데일리고정커버드콜	490590	0.25%	~20%(추정)	78억/2~20억	월지급(말일)	데일리고정(10%)	KEDI 미국 AI밸류체인 90%참여+데일리옵션 프리미엄 지수(총수익지수)	NASDAQ100 Option	24.10	목표분배율 없음(10% 콜옵션매도로 분배금 지급)		https://www.riseetf.co.kr/prod/finderDetail/44H1			
중국빅테크	CN	RISE 차이나테크TOP10위클리타겟커버드콜	0094L0	0.30%	12%(타겟)	145억		위클리타겟	Bloomberg China Tech Select TOP 10 + 12% Target Premium Weekly Index			텐센트/샤오미/알리바바/BYD/메이투안/네티즈/트립닷컴/징동닷컴/바이두		https://blog.naver.com/riseetf/223985313558			
중국빅테크	CN	PLUS 차이나항셍테크위클리타겟커버드콜	0128D0	0.39%	15%(타겟)	72억		위클리타겟	HSTECH 15% Target Premium Weekly Covered Call Index			알리바바/SMIC/텐센트/메이투안/네티즈/비야디/샤오미/징동닷컴/콰이쇼우/트립닷컴		https://www.plusetf.co.kr/insight/report/detail?n=1103			
미국빅테크	미국	TIGER 미국테크TOP10타겟커버드콜	474220	0.50%	10%(타겟)	3919억/50~100억	월지급(15일)	Monthly타겟(~40%)	Bloomberg U.S. Tech Top10+10% Premium Covered Call 지수(원화환산)	e-mini NASDAQ100 옵션	24.01	SDAQ100 ATM 콜옵션 매도		https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7474220001			
미국빅테크	미국	ACE 미국빅테크7+데일리타겟커버드콜(합성)	480020	0.45%	15%(타겟)	1605억/10~50억	월지급(15일)	데일리타겟	Bloomberg US Big Tech Top7 Plus Premium Decrement 15% Distribution Index	QQQ OTM 1% 커버드콜	24.04	매일 1% 지수수익률 추종		https://www.aceetf.co.kr/fund/K55101E97763	https://blog.naver.com/aceetf/223420629849		
미국빅테크	미국	RISE 미국테크100데일리고정커버드콜	491620	0.25%	~20%(추정)	77억/10~30억	월지급(말일)	데일리고정(10%)	KEDI 미국 테크100 90%참여+데일리옵션 프리미엄 지수	NDX(NASDAQ100) 콜옵션 매도	24.10	미국테크100 지수 90% 추종		https://riseetf.co.kr/prod/finderDetail/44H5	https://blog.naver.com/riseetf/223590046608		
미국반도체	미국	ACE 미국반도체데일리타겟커버드콜(합성)	480040	0.45%	15%(타겟)	835억/10~20억	월지급(15일)	데일리타겟	Bloomberg US Listed Semiconductor Premium Decrement 15% Distribution Index	QQQ 외가격(OTM) 1% 콜옵션 매도	24.04	매일 1% 지수수익률 추종		https://www.aceetf.co.kr/fund/K55101E96450	https://blog.naver.com/aceetf/223420629849		
SCHD	미국	TIGER 미국배당다우존스타겟커버드콜2호	458760	0.39%	10~11%(추정)	7378억/50~300억	월지급(말일)	Monthly타겟(~40%)	Dow Jones U.S. Dividend 100 7% Premium Covered Call 지수(Total Return)(원화환산)	S&P 500 ATM 콜옵션 매도	23.06	SCHD(60%) 3~4%+S&P500옵션(40%) 7% 분배		https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7458760006			
SCHD	미국	TIGER 미국배당다우존스타겟커버드콜1호	458750	0.39%	6~7%(추정)	626억/2~20억	월지급(15일)	Monthly타겟(~40%)	Dow Jones U.S. Dividend 100 3% Premium Covered Call 지수	S&P 500 ATM 콜옵션 매도	23.06	SCHD(85%) 3~4%+S&P500옵션(15%) 3% 분배		https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7458750007			
SCHD	미국	KODEX 미국배당다우존스타겟커버드콜	483290	0.39%	13.5%(타겟)	927억/10~50억	월지급(말일)	Monthly타겟(~40%)	Dow Jones U.S. Dividend 100 10% Premium Covered Call Index(Total Return)	S&P 500 ATM 콜옵션 매도	24.05	SCHD 3~4%+S&P500타겟프리미엄 10% 분배		https://www.samsungfund.com/etf/product/view.do?id=2ETFN1			
SCHD	미국	TIGER 미국배당다우존스타겟데일리커버드콜	0008S0	0.25%	12%(타겟)		월지급(15일)	데일리타겟(~10%)	Dow Jones US Dividend 100지수	S&P 500 ATM 콜옵션 매도(10%)	25.01			https://blog.naver.com/PostView.naver?blogId=m_invest&logNo=223725695732&categoryNo=0&parentCategoryNo=0&viewDate=&currentPage=1&postListTopCurrentPage=&from=&userTopListOpen=true&userTopListCount=5&userTopListManageOpen=false&userTopListCurrentPage=1			
미국배당	미국	PLUS 미국배당증가성장주데일리커버드콜	494420	0.39%	12~15%(추정)	77억/1~10억	월지급(말일)	데일리고정(15%)	Bloomberg 1000 Dividend Growth(85%)	SPY(S&P500) 콜옵션 매도(15%)	24.10	미국배당증가성장주(85%) 2% + S&P500옵션 10~13%(추정) 분배		https://www.plusetf.co.kr/insight/report/detail?n=342	https://www.plusetf.co.kr/product/detail?n=006376		
미국배당	미국	RISE 미국배당100데일리고정커버드콜	490600	0.25%	12%(추정)	217억/10~50억	월지급(말일)	데일리고정(10%)	KEDI 미국 배당100 (90%)	SPY(S&P500) 콜옵션 매도(10%)	24.09	미국배당100(90%) 2%(추정) + S&P500옵션 10%(추정) 분배	0%	https://www.riseetf.co.kr/prod/finderDetail/44H2	https://blog.naver.com/riseetf/223590046608	https://datacenter.hankyung.com/kedi/kusdv100p	
혼합형	미국	KODEX 테슬라커버드콜채권혼합액티브	475080	0.39%	15%	2096억/10~30억	월지급(말일)	Monthly	KAP 한국종합채권 2-3Y 지수(AA-이상, 총수익) (70%)	TSLY (~30%)	24.01	한국채권(70%)+미국테슬라본주/TSLY(30%)		https://www.samsungfund.com/etf/product/view.do?id=2ETFM1			
혼합형	미국	RISE 테슬라미국채타겟커버드콜혼합(합성)	0013R0	0.25%	~15%(추정)	100억	월지급(말일)	Monthly	KEDI 테슬라미국30년국채15%타겟프리미엄 혼합지수(TR)	TLT(~23% 추정), TSLY(~5%)	25.02	미국30년국채(70%)+테슬라(30%)		https://www.riseetf.co.kr/prod/finderDetail/44I1			
혼합형	미국	TIGER 엔비디아미국채커버드콜밸런스(합성)	0000D0	0.39%	12~15%(추정)	445억	월지급(말일)	Weekly	KEDI 미국30년국채커버드콜 17.14 지수	TLT(~40%)	24.12	엔비디아(30%)+미국채30년커버드콜(30%)		https://www.tigeretf.com/ko/insight/hot-etf-introduce/view.do?listCnt=6&pageIndex=1&detailsKey=516&q=			
혼합형	CN	FOCUS 알리바바미국채커버드콜혼합	0073X0	0.36%		80억	월지급(말일)	Weekly	KEDI 알리바바미국채커버드콜혼합지수(TR)		25.07						
혼합형	미국	SOL 팔란티어커버드콜OTM채권혼합	0040Y0	0.35%	24%	626억	월지급(말일)					팔란티어 주식+팔란티어 103% OTM 위클리 콜옵션 매도 30%, 단기국고채 70%		https://www.soletf.com/ko/fund/etf/211088?tabIndex=3			
혼합형(IRP100)	미국	SOL 팔란티어미국채커버드콜혼합	0040X0	0.35%	25%	215억	월지급(말일)							https://www.soletf.com/ko/fund/etf/211089			
혼합형(IRP100)	미국	PLUS 테슬라위클리커버드콜채권혼합	0132K0	0.39%	24%(타겟)	294억	월지급(말일)	Weekly						https://www.plusetf.co.kr/insight/report/detail?n=1164			
ACTIVE.CC	미국	KODEX 미국성장커버드콜액티브	0144L0	0.49%	10%(추정)	251억	월지급(말일)		개별주식옵션 활용		25.12	수익성 기대되는 테크 성장주에 투자하며 탄력적 옵션 매도로 월배당을 동시에 추구		https://www.samsungfund.com/etf/product/view.do?id=2ETFT4	https://www.samsungfund.com/etf/insight/newsroom/view.do?seq=72033		
미국배당	미국	KODEX 미국배당커버드콜액티브	441640	0.19%	8%+(추정)	917억/10~20억	월지급(15일)	Active(M/W/D 동시사용)	S&P500 배당성장주	Amplify+CWP 배당자문	22.09	콜옵션매도비율 조절 / 8%~9% 분배	0%	https://www.samsungfund.com/etf/product/view.do?id=2ETFH4			`;

async function seed() {
  const lines = data.split("\n").filter(l => l.trim() !== "");
  
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    
    const name = parts[2]?.trim();
    if (!name) continue;

    const etfData = {
      mainCategory: "해외.커버드콜",
      subCategory: parts[0]?.trim() || "",
      country: parts[1]?.trim() || "",
      name: name,
      code: parts[3]?.trim() || "",
      fee: parts[4]?.trim() || "",
      yield: parts[5]?.trim() || "",
      marketCap: parts[6]?.trim() || "",
      dividendCycle: parts[7]?.trim() || "",
      optionType: parts[8]?.trim() || "",
      underlyingAsset: parts[9]?.trim() || "",
      callOption: parts[10]?.trim() || "",
      listingDate: parts[11]?.trim() || "",
      notes: parts[12]?.trim() || "",
      linkProduct: parts[14]?.trim() || "",
      linkBlog: parts[15]?.trim() || ""
    };
    
    try {
      const existing = await storage.getEtfs();
      const found = existing.find(e => e.code === etfData.code);
      
      if (found) {
        await storage.updateEtf(found.id, etfData);
      } else {
        await storage.createEtf(etfData);
      }
    } catch (e) {
      console.error(`Error for ${etfData.name}:`, e);
    }
  }
}

seed().then(() => console.log("Seeding complete"));
