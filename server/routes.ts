import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import axios from "axios";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Real-time price update endpoint
  app.post("/api/etfs/:id/refresh", async (req, res) => {
    try {
      const etf = await storage.getEtf(Number(req.params.id));
      if (!etf) return res.status(404).json({ message: "ETF not found" });

      // In a real app, we would use Alpha Vantage or Finnhub here.
      // For this demo, we'll simulate a price fetch if no API key is set.
      const API_KEY = process.env.FINNHUB_API_KEY;
      let price = etf.currentPrice ? parseFloat(etf.currentPrice) : 10000;
      let change = 0;

      if (API_KEY) {
        const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${etf.code}&token=${API_KEY}`);
        price = response.data.c;
        change = response.data.dp;
      } else {
        // Mock some movement
        price = price * (1 + (Math.random() * 0.02 - 0.01));
        change = (Math.random() * 4 - 2);
      }

      const updated = await storage.updateEtf(etf.id, {
        currentPrice: price.toString(),
        dailyChangeRate: change.toString()
      });

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to refresh price" });
    }
  });

  app.get(api.etfs.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const mainCategory = req.query.mainCategory as string | undefined;
    const subCategory = req.query.subCategory as string | undefined;
    const country = req.query.country as string | undefined;
    const etfs = await storage.getEtfs({ search, mainCategory, subCategory, country });
    res.json(etfs);
  });

  app.get(api.etfs.get.path, async (req, res) => {
    const etf = await storage.getEtf(Number(req.params.id));
    if (!etf) {
      return res.status(404).json({ message: 'ETF not found' });
    }
    res.json(etf);
  });

  app.post(api.etfs.create.path, async (req, res) => {
    try {
      const input = api.etfs.create.input.parse(req.body);
      const etf = await storage.createEtf(input);
      res.status(201).json(etf);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.etfs.update.path, async (req, res) => {
    try {
      const input = api.etfs.update.input.parse(req.body);
      const etf = await storage.updateEtf(Number(req.params.id), input);
      if (!etf) {
        return res.status(404).json({ message: 'ETF not found' });
      }
      res.json(etf);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.etfs.delete.path, async (req, res) => {
    await storage.deleteEtf(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/trends", async (req, res) => {
    const trends = await storage.getTrendingEtfs();
    res.json(trends);
  });

  app.get("/api/recommended", async (req, res) => {
    const recommended = await storage.getRecommendedEtfs();
    res.json(recommended);
  });

  app.post("/api/seed", async (req, res) => {
    try {
      await seedDatabase(true);
      const etfs = await storage.getEtfs();
      res.json({ success: true, count: etfs.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to seed database" });
    }
  });

  // Background task to periodically update scores and recommendations
  setInterval(async () => {
    try {
      const all = await storage.getEtfs();
      for (const etf of all) {
        // Randomly update scores for demo trends
        const newScore = Math.floor(Math.random() * 100);
        const shouldRecommend = newScore > 85;
        await storage.updateEtf(etf.id, { 
          trendScore: newScore.toString(),
          isRecommended: shouldRecommend 
        });
      }
    } catch (e) {
      console.error("Failed background update", e);
    }
  }, 60000); // Every minute

  const existingEtfs = await storage.getEtfs();
  if (existingEtfs.length < 50) {
    console.log(`Database has only ${existingEtfs.length} ETFs, force seeding...`);
    await seedDatabase(true);
  }

  return httpServer;
}

async function seedDatabase(force: boolean = false) {
  const existing = await storage.getEtfs();
  if (existing.length === 0 || (force && existing.length < 50)) {
    if (force) {
      for (const etf of existing) {
        await storage.deleteEtf(etf.id);
      }
    }
    const seeds = [
      // 해외.커버드콜 - 미국국채
      { mainCategory: "해외.커버드콜", subCategory: "미국국채", generation: "2세대", country: "미국", name: "TIGER 미국30년국채커버드콜액티브(H)", code: "476550", fee: "0.39%", yield: "12%(타겟)", marketCap: "1.1조/>100억", dividendCycle: "월지급(말일)", optionType: "위클리(30%)", underlyingAsset: "KEDI US Treasury 30Y Weekly Covered Call 30 Index", callOption: "TLT", listingDate: "24.02", notes: "환헷지", linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7476550009" },
      { mainCategory: "해외.커버드콜", subCategory: "미국국채", generation: "2세대", country: "미국", name: "KODEX 미국30년국채타겟커버드콜(합성 H)", code: "481060", fee: "0.25%", yield: "12%(타겟)", marketCap: "4142억/50~150억", dividendCycle: "월지급(15일)", optionType: "위클리(30%)", underlyingAsset: "Bloomberg U.S.Treasury 20+ Year(TLT)+ 12% Premium Covered Call index(Total Return)", callOption: "TLT", listingDate: "24.04", notes: "환헷지/옵션매도비중조절", linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFM9" },
      { mainCategory: "해외.커버드콜", subCategory: "미국국채", country: "미국", name: "RISE 미국30년국채커버드콜(합성)", code: "472830", fee: "0.25%", yield: "12%(타겟)", marketCap: "1800억/30~100억", dividendCycle: "월지급(말일)", optionType: "위클리", underlyingAsset: "KEDI US Treasury 30Y Weekly Covered Call 30 Index", callOption: "TLT", listingDate: "23.12", notes: "환노출/실제 배당액은 11%미만임('24.11월 현재)", linkProduct: "https://www.riseetf.co.kr/prod/finderDetail/44F8" },
      { mainCategory: "해외.커버드콜", subCategory: "미국국채", country: "미국", name: "SOL 미국30년국채커버드콜(합성)", code: "473330", fee: "0.25%", yield: "12%(타겟)", marketCap: "3600억/100~200억", dividendCycle: "월지급(말일)", optionType: "위클리", underlyingAsset: "KEDI US Treasury 30Y Weekly Covered Call 30 Index", callOption: "TLT", listingDate: "23.12", notes: "환노출/실제 배당액은 12%정도('24.11월 현재)", linkProduct: "https://www.soletf.com/ko/fund/etf/211044" },
      // 해외.커버드콜 - 나스닥100
      { mainCategory: "해외.커버드콜", subCategory: "나스닥100", generation: "1세대", country: "미국", name: "TIGER 미국나스닥100커버드콜(합성)", code: "441680", fee: "0.37%", yield: "12%(타겟)", marketCap: "3557억/10~50억", dividendCycle: "월지급(말일)", optionType: "Monthly타겟(~100%)", underlyingAsset: "CBOE Nasdaq-100 BuyWrite V2 지수(Total Return)(원화환산)", callOption: "ATM Nasdaq-100 콜옵션", listingDate: "22.09", linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7441680006" },
      { mainCategory: "해외.커버드콜", subCategory: "나스닥100", generation: "3세대", country: "미국", name: "TIGER 미국나스닥100타겟데일리커버드콜", code: "486290", fee: "0.25%", yield: "15%(타겟)", marketCap: "5092억/50~150억", dividendCycle: "월지급(말일)", optionType: "데일리타겟(15%+-)", underlyingAsset: "NASDAQ-100 Daily Covered Call Target Premium 15% 지수(Total Return)(원화환산)", callOption: "NASDAQ100 콜옵션", listingDate: "24.06", linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7486290000" },
      { mainCategory: "해외.커버드콜", subCategory: "나스닥100", country: "미국", name: "KODEX 미국나스닥100데일리커버드콜OTM", code: "494300", fee: "0.25%", yield: "Max.20%", dividendCycle: "월지급(말일)", optionType: "데일리", underlyingAsset: "Nasdaq-100 Index", listingDate: "24.10", notes: "나스닥100 상승 1% 추종/실물옵션 매매/추가 프리미엄은 재투자", linkProduct: "https://www.samsungfund.com/etf/insight/newsroom/view.do?seq=63073" },
      // 해외.커버드콜 - S&P500
      { mainCategory: "해외.커버드콜", subCategory: "S&P500", country: "미국", name: "TIGER 미국S&P500타겟데일리커버드콜", code: "482730", fee: "0.25%", yield: "10%(타겟)", dividendCycle: "월지급(말일)", optionType: "데일리타겟", underlyingAsset: "S&P 500 Daily Covered Call Target Premium 10% Index", listingDate: "24.05", notes: "10%프리미엄타겟 매도비중 조절", linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7482730009" },
      { mainCategory: "해외.커버드콜", subCategory: "S&P500", country: "미국", name: "SOL 미국500타겟커버드콜액티브", code: "494210", fee: "0.35%", yield: "12%(타겟)", dividendCycle: "월지급(말일)", optionType: "위클리타겟", underlyingAsset: "S&P 500 Index", listingDate: "24.10", notes: "Active운용/옵션매도비중조절", linkProduct: "https://www.soletf.com/ko/fund/etf/211064" },
      { mainCategory: "해외.커버드콜", subCategory: "S&P500", country: "미국", name: "ACE 미국500데일리타겟커버드콜(합성)", code: "480030", fee: "0.45%", yield: "15%(타겟)", dividendCycle: "월지급(말일)", optionType: "데일리타겟", underlyingAsset: "S&P 500 Index", listingDate: "24.04", notes: "S&P500의 일일 0.7%만 지수추종", linkProduct: "https://www.aceetf.co.kr/fund/K55101E97755" },
      { mainCategory: "해외.커버드콜", subCategory: "S&P500", country: "미국", name: "KODEX 미국S&P500 데일리 커버드콜 OTM", code: "0005A0", fee: "0.25%", yield: "15%(타겟)", dividendCycle: "월지급(말일)", optionType: "데일리OTM", underlyingAsset: "S&P 500 Index", listingDate: "25.01", notes: "S&P500의 일일 1%까지 지수추종", linkProduct: "https://www.samsungfund.com/etf/insight/newsroom/view.do?seq=64514" },
      // 해외.커버드콜 - AI테크
      { mainCategory: "해외.커버드콜", subCategory: "AI테크", country: "미국", name: "KODEX 미국AI테크TOP10타겟커버드콜", code: "483280", fee: "0.39%", yield: "15%(타겟)", dividendCycle: "월지급(말일)", optionType: "위클리타겟", listingDate: "24.05", notes: "AI 투자방식(시가총액 + LLM모델)로 AI 관련주 선별, 직접운용", linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFN2" },
      { mainCategory: "해외.커버드콜", subCategory: "AI테크", country: "미국", name: "TIGER 미국AI빅테크10타겟데일리커버드콜", code: "493810", fee: "0.25%", yield: "15%(타겟)", dividendCycle: "월지급(말일)", optionType: "데일리타겟", listingDate: "24.10", notes: "수익성과 성장성을 고려한 AI 투자 + 월배당", linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7493810006" },
      { mainCategory: "해외.커버드콜", subCategory: "AI테크", country: "미국", name: "RISE 미국AI밸류체인데일리고정커버드콜", code: "490590", fee: "0.25%", yield: "~20%(추정)", dividendCycle: "월지급(말일)", optionType: "데일리고정(10%)", listingDate: "24.10", notes: "목표분배율 없음(10% 콜옵션매도로 분배금 지급)", linkProduct: "https://www.riseetf.co.kr/prod/finderDetail/44H1" },
      // 해외.커버드콜 - 중국빅테크
      { mainCategory: "해외.커버드콜", subCategory: "중국빅테크", country: "CN", name: "RISE 차이나테크TOP10위클리타겟커버드콜", code: "0094L0", fee: "0.30%", yield: "12%(타겟)", dividendCycle: "월지급(말일)", notes: "텐센트/샤오미/알리바바/BYD/메이투안/네티즈/트립닷컴/징동닷컴/바이두", linkProduct: "https://blog.naver.com/riseetf/223985313558" },
      { mainCategory: "해외.커버드콜", subCategory: "중국빅테크", country: "CN", name: "PLUS 차이나항셍테크위클리타겟커버드콜", code: "0128D0", fee: "0.39%", yield: "15%(타겟)", dividendCycle: "월지급(말일)", notes: "알리바바/SMIC/텐센트/메이투안/네티즈/비야디/샤오미/징동닷컴/콰이쇼우/트립닷컴", linkProduct: "https://www.plusetf.co.kr/insight/report/detail?n=1103" },
      // 해외.커버드콜 - 미국빅테크
      { mainCategory: "해외.커버드콜", subCategory: "미국빅테크", country: "미국", name: "TIGER 미국테크TOP10타겟커버드콜", code: "474220", fee: "0.50%", yield: "10%(타겟)", dividendCycle: "월지급(말일)", optionType: "위클리타겟", listingDate: "24.01", notes: "SDAQ100 ATM 콜옵션 매도", linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7474220001" },
      { mainCategory: "해외.커버드콜", subCategory: "미국빅테크", country: "미국", name: "ACE 미국빅테크7+데일리타겟커버드콜(합성)", code: "480020", fee: "0.45%", yield: "15%(타겟)", dividendCycle: "월지급(말일)", optionType: "데일리타겟", listingDate: "24.04", notes: "매일 1% 지수수익률 추종", linkProduct: "https://www.aceetf.co.kr/fund/K55101E97763" },
      { mainCategory: "해외.커버드콜", subCategory: "미국빅테크", country: "미국", name: "RISE 미국테크100데일리고정커버드콜", code: "491620", fee: "0.25%", yield: "~20%(추정)", dividendCycle: "월지급(말일)", optionType: "데일리고정(10%)", listingDate: "24.10", notes: "미국테크100 지수 90% 추종", linkProduct: "https://riseetf.co.kr/prod/finderDetail/44H5" },
      // 해외.커버드콜 - 미국반도체
      { mainCategory: "해외.커버드콜", subCategory: "미국반도체", country: "미국", name: "ACE 미국반도체데일리타겟커버드콜(합성)", code: "480040", fee: "0.45%", yield: "15%(타겟)", dividendCycle: "월지급(말일)", optionType: "데일리타겟", listingDate: "24.04", notes: "매일 1% 지수수익률 추종", linkProduct: "https://www.aceetf.co.kr/fund/K55101E96450" },
      // 해외.커버드콜 - SCHD
      { mainCategory: "해외.커버드콜", subCategory: "SCHD", country: "미국", name: "TIGER 미국배당다우존스타겟커버드콜2호", code: "458760", fee: "0.39%", yield: "10~11%(추정)", dividendCycle: "월지급(말일)", optionType: "위클리타겟(40%)", listingDate: "23.06", notes: "SCHD(60%) 3~4%+S&P500옵션(40%) 7% 분배", linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7458760006" },
      { mainCategory: "해외.커버드콜", subCategory: "SCHD", country: "미국", name: "TIGER 미국배당다우존스타겟커버드콜1호", code: "458750", fee: "0.39%", yield: "6~7%(추정)", dividendCycle: "월지급(말일)", optionType: "위클리타겟(15%)", listingDate: "23.06", notes: "SCHD(85%) 3~4%+S&P500옵션(15%) 3% 분배", linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7458750007" },
      { mainCategory: "해외.커버드콜", subCategory: "SCHD", country: "미국", name: "KODEX 미국배당다우존스타겟커버드콜", code: "483290", fee: "0.39%", yield: "13.5%(타겟)", dividendCycle: "월지급(말일)", optionType: "타겟", listingDate: "24.05", notes: "SCHD 3~4%+S&P500타겟프리미엄 10% 분배", linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFN1" },
      { mainCategory: "해외.커버드콜", subCategory: "SCHD", country: "미국", name: "TIGER 미국배당다우존스타겟데일리커버드콜", code: "0008S0", fee: "0.25%", yield: "12%(타겟)", dividendCycle: "월지급(말일)", optionType: "데일리타겟", listingDate: "25.01", linkProduct: "https://blog.naver.com/PostView.naver?blogId=m_invest&logNo=223725695732" },
      // 해외.커버드콜 - 미국배당
      { mainCategory: "해외.커버드콜", subCategory: "미국배당", country: "미국", name: "PLUS 미국배당증가성장주데일리커버드콜", code: "494420", fee: "0.39%", yield: "12~15%(추정)", marketCap: "77억/1~10억", dividendCycle: "월지급(말일)", optionType: "데일리고정(15%)", underlyingAsset: "Bloomberg 1000 Dividend Growth(85%)", callOption: "SPY(S&P500) 콜옵션 매도(15%)", listingDate: "24.10", notes: "미국배당증가성장주(85%) 2% + S&P500옵션 10~13%(추정) 분배", linkProduct: "https://www.plusetf.co.kr/insight/report/detail?n=342" },
      { mainCategory: "해외.커버드콜", subCategory: "미국배당", country: "미국", name: "RISE 미국배당100데일리고정커버드콜", code: "490600", fee: "0.25%", yield: "12%(추정)", marketCap: "217억/10~50억", dividendCycle: "월지급(말일)", optionType: "데일리고정(10%)", underlyingAsset: "KEDI 미국 배당100 (90%)", callOption: "SPY(S&P500) 콜옵션 매도(10%)", listingDate: "24.09", notes: "미국배당100(90%) 2%(추정) + S&P500옵션 10%(추정) 분배", linkProduct: "https://www.riseetf.co.kr/prod/finderDetail/44H2" },
      { mainCategory: "해외.커버드콜", subCategory: "미국배당", country: "미국", name: "KODEX 미국배당커버드콜액티브", code: "441640", fee: "0.19%", yield: "8%+(추정)", dividendCycle: "월지급(말일)", listingDate: "22.09", notes: "콜옵션매도비율 조절 / 8%~9% 분배", linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFH4" },
      // 해외.커버드콜 - 혼합형
      { mainCategory: "해외.커버드콜", subCategory: "혼합형", country: "미국", name: "KODEX 테슬라커버드콜채권혼합액티브", code: "475080", fee: "0.39%", yield: "15%", marketCap: "2096억/10~30억", dividendCycle: "월지급(말일)", optionType: "Monthly", underlyingAsset: "KAP 한국종합채권 2-3Y 지수(AA-이상, 총수익) (70%)", callOption: "TSLY (~30%)", listingDate: "24.01", notes: "한국채권(70%)+미국테슬라본주/TSLY(30%)", linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFM1" },
      { mainCategory: "해외.커버드콜", subCategory: "혼합형", country: "미국", name: "RISE 테슬라미국채타겟커버드콜혼합(합성)", code: "0013R0", fee: "0.25%", yield: "~15%(추정)", dividendCycle: "월지급(말일)", optionType: "Monthly", listingDate: "25.02", notes: "미국30년국채(70%)+테슬라(30%)", linkProduct: "https://www.riseetf.co.kr/prod/finderDetail/44I1" },
      { mainCategory: "해외.커버드콜", subCategory: "혼합형", country: "미국", name: "TIGER 엔비디아미국채커버드콜밸런스(합성)", code: "0000D0", fee: "0.39%", yield: "12~15%(추정)", dividendCycle: "월지급(말일)", listingDate: "24.12", notes: "엔비디아(30%)+미국채30년커버드콜(30%)", linkProduct: "https://www.tigeretf.com/ko/insight/hot-etf-introduce/view.do?listCnt=6&pageIndex=1&detailsKey=516" },
      { mainCategory: "해외.커버드콜", subCategory: "혼합형", country: "CN", name: "FOCUS 알리바바미국채커버드콜혼합", code: "0073X0", fee: "0.36%", listingDate: "25.07" },
      { mainCategory: "해외.커버드콜", subCategory: "혼합형", country: "미국", name: "SOL 팔란티어커버드콜OTM채권혼합", code: "0040Y0", fee: "0.35%", yield: "24%", dividendCycle: "월지급(말일)", notes: "팔란티어 주식+팔란티어 103% OTM 위클리 콜옵션 매도 30%, 단기국고채 70%", linkProduct: "https://www.soletf.com/ko/fund/etf/211088?tabIndex=3" },
      // 해외.커버드콜 - 혼합형(IRP100)
      { mainCategory: "해외.커버드콜", subCategory: "혼합형(IRP100)", country: "미국", name: "SOL 팔란티어미국채커버드콜혼합", code: "0040X0", fee: "0.35%", yield: "25%", dividendCycle: "월지급(말일)", linkProduct: "https://www.soletf.com/ko/fund/etf/211089" },
      { mainCategory: "해외.커버드콜", subCategory: "혼합형(IRP100)", country: "미국", name: "PLUS 테슬라위클리커버드콜채권혼합", code: "0132K0", fee: "0.39%", yield: "24%(타겟)", dividendCycle: "월지급(말일)", linkProduct: "https://www.plusetf.co.kr/insight/report/detail?n=1164" },
      // 해외.커버드콜 - ACTIVE.CC
      { mainCategory: "해외.커버드콜", subCategory: "ACTIVE.CC", country: "미국", name: "KODEX 미국성장커버드콜액티브", code: "0144L0", fee: "0.49%", yield: "10%(추정)", dividendCycle: "월지급(말일)", listingDate: "25.12", notes: "수익성 기대되는 테크 성장주에 투자하며 탄력적 옵션 매도로 월배당을 동시에 추구", linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFT4" },

      // 해외.액티브
      { mainCategory: "해외.액티브", subCategory: "Index", generation: "Active", country: "W", name: "TIGER 토탈월드스탁액티브", code: "0060H0", fee: "0.25%", yield: "-" },
      { mainCategory: "해외.액티브", subCategory: "에너지/인프라", generation: "Active", country: "미국", name: "TIGER 글로벌AI전력인프라 액티브", code: "491010", fee: "0.49%", yield: "-" },
      { mainCategory: "해외.액티브", subCategory: "NASDAQ", generation: "Active", country: "미국", name: "TIMEFOLIO 미국나스닥100액티브", code: "TIMEFOLIO_NDX", fee: "1.24%", yield: "-", listingDate: "22.05", notes: "테슬라/엔비디아/마이크로스트래티지/알파벳/메타", isFavorite: true },
      { mainCategory: "해외.액티브", subCategory: "S&P500", generation: "Active", country: "미국", name: "TIMEFOLIO 미국S&P500액티브", code: "426020", fee: "0.69%", yield: "-", isFavorite: true },
      { mainCategory: "해외.액티브", subCategory: "DOW", generation: "Active", country: "미국", name: "TIMEFOLIO 미국배당다우존스액티브", code: "0036D0", fee: "0.80%", yield: "-", linkProduct: "https://www.timefolio.co.kr/etf/funds_view.php?PID=21" },
      { mainCategory: "해외.액티브", subCategory: "EMP", generation: "Active", country: "미국", name: "TIMEFOLIO 글로벌탑픽액티브", code: "0113D0", fee: "0.06%", yield: "-", listingDate: "25.10", isRecommended: true },
      { mainCategory: "해외.액티브", subCategory: "AI", generation: "Active", country: "CN", name: "TIMEFOLIO 차이나AI테크액티브", code: "0043Y0", fee: "0.80%", yield: "-", listingDate: "25.05", notes: "Tencent/Alibaba/Xiaomi/Zhejiang/BYD/SMIC/XPeng/TSMC", isRecommended: true, isFavorite: true },
      { mainCategory: "해외.액티브", subCategory: "NASDAQ", generation: "Active", country: "US", name: "KoAct 미국나스닥성장기업액티브", code: "0015B0", fee: "0.50%", yield: "-", listingDate: "25.02", notes: "팔란티어/브로드컴/알파벳", linkProduct: "https://www.samsungactive.co.kr/etf/view.do?id=2ETFQ1" },
      { mainCategory: "해외.액티브", subCategory: "S&P500", generation: "Active", country: "미국", name: "KODEX 미국S&P500액티브", code: "0041E0", fee: "0.45%", yield: "-", listingDate: "25.04", notes: "S&P500 지수의 상위 100여개 종목에 '압축' 투자", linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFQ9" },
      { mainCategory: "해외.액티브", subCategory: "금융", generation: "Active", country: "미국", name: "KODEX 미국금융테크액티브", code: "0028X0", fee: "0.45%", yield: "-", listingDate: "25.05", notes: "쇼피파이/누홀딩스/뱅크오브뉴욕멜론/CME.G/VISA/BlackRock/Paypal", linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFQ6" },
      { mainCategory: "해외.액티브", subCategory: "AI", generation: "Active", country: "CN", name: "KODEX 차이나AI테크액티브", code: "428510", fee: "0.50%", yield: "-", listingDate: "22.05" },
      { mainCategory: "해외.액티브", subCategory: "A/M", generation: "Active", country: "미국", name: "ACE 글로벌자율주행액티브", code: "ACE_AV", fee: "0.62%", yield: "-", listingDate: "22.02", notes: "테슬라/팔란티어/TSLL/알파벳/모빌아이" },
      { mainCategory: "해외.액티브", subCategory: "AI", generation: "Active", country: "미국", name: "ACE 미국AI테크핵심산업액티브", code: "0118Z0", fee: "0.45%", yield: "-", listingDate: "25.10" },
      { mainCategory: "해외.액티브", subCategory: "AI", generation: "Active", country: "미국", name: "HANARO 글로벌생성형AI액티브", code: "HANARO_AI", fee: "1.25%", yield: "-", listingDate: "23.07", notes: "팔란티어/엔비디아/앱러빈/브로드컴/TSMC" },

      // 해외패시브&기타 - 혼합형
      { mainCategory: "해외패시브&기타", subCategory: "혼합형", generation: "Passive", country: "미국", name: "TIGER 미국나스닥100채권혼합Fn", code: "435420", fee: "0.25%", yield: "1.30%", listingDate: "22.07", notes: "NASDAQ100(30%) vs 국내단기채권(70%)" },
      { mainCategory: "해외패시브&기타", subCategory: "혼합형", generation: "Passive", country: "미국", name: "TIGER 미국테크TOP10채권혼합", code: "472170", fee: "0.25%", yield: "1.90%", listingDate: "23.12", isRecommended: true },
      { mainCategory: "해외패시브&기타", subCategory: "혼합형", generation: "Passive", country: "미국", name: "ACE글로벌인컴TOP10", code: "460960", fee: "0.24%", yield: "8%(추정)", listingDate: "23.07", notes: "커버드콜+고배당+하이일드채권 (주식형*5EA+채권형*5EA)" },
      { mainCategory: "해외패시브&기타", subCategory: "혼합형", generation: "Passive", country: "미국", name: "SOL 미국배당미국채혼합50", code: "490490", fee: "0.15%", yield: "3.50%", listingDate: "24.09", notes: "커버드콜 아님" },
      // 해외패시브&기타 - 채권형
      { mainCategory: "해외패시브&기타", subCategory: "채권형", generation: "Passive", country: "미국", name: "KODEX iShares미국하이일드액티브", code: "468380", fee: "0.15%", yield: "6.30%", listingDate: "23.10", notes: "평균 Duration: 3.23년" },
      { mainCategory: "해외패시브&기타", subCategory: "채권형", generation: "Passive", country: "미국", name: "ACE 미국30년국채엔화노출액티브(H)", code: "476750", fee: "0.15%", yield: "2.60%", listingDate: "24.03" },
      { mainCategory: "해외패시브&기타", subCategory: "채권형", generation: "Passive", country: "미국", name: "RISE 미국30년국채엔화노출(합성 H)", code: "472870", fee: "0.15%", yield: "2.80%", listingDate: "24.02" },
      // 해외패시브&기타 - Tech
      { mainCategory: "해외패시브&기타", subCategory: "Tech", generation: "Passive", country: "US", name: "TIGER 글로벌클라우드컴퓨팅INDXX", code: "TIGER_CLOUD", fee: "0.64%", yield: "-", listingDate: "20.12", notes: "트윌리오/스노우플레이크/쇼피파이", isRecommended: true },
      // 해외패시브&기타 - AI
      { mainCategory: "해외패시브&기타", subCategory: "AI", generation: "Passive", country: "US", name: "KODEX 미국AI소프트웨어TOP10", code: "0041D0", fee: "0.45%", yield: "-", listingDate: "25.04", notes: "팔란티어,MS,세일즈포스 등" },
      // 해외패시브&기타 - M7
      { mainCategory: "해외패시브&기타", subCategory: "M7", generation: "Passive", country: "US", name: "ACE미국빅테크TOP7PLUS", code: "ACE_M7", fee: "0.30%", yield: "-", listingDate: "23.09", notes: "아마존/구글/엔비디아/MS/애플/브로드컴/메타/테슬라" },
      // 해외패시브&기타 - 파킹형
      { mainCategory: "해외패시브&기타", subCategory: "파킹형", generation: "Passive", country: "US", name: "Kodex 미국달러SOFR금리 액티브(합성)", code: "455030", fee: "0.15%", yield: "-", listingDate: "23.04" },
      { mainCategory: "해외패시브&기타", subCategory: "파킹형", generation: "Passive", country: "US", name: "TIGER 미국달러SOFR금리액티브(합성)", code: "456610", fee: "0.05%", yield: "-", listingDate: "23.05" },

      // 국내자산 - 국내배당
      { mainCategory: "국내자산", subCategory: "국내배당", generation: "Domestic", country: "한국", name: "PLUS 고배당주위클리커버드콜", code: "489030", fee: "0.30%", yield: "14.40%", listingDate: "24.08", notes: "비과세 옵션프리미엄 절세혜택" },
      { mainCategory: "국내자산", subCategory: "국내배당", generation: "Domestic", country: "한국", name: "TIGER 은행고배당플러스TOP10", code: "466940", fee: "0.30%", yield: "6~7%", listingDate: "23.10" },
      { mainCategory: "국내자산", subCategory: "국내배당", generation: "Domestic", country: "한국", name: "TIGER 배당커버드콜액티브", code: "472150", fee: "0.50%", yield: "15~23%", listingDate: "23.12" },
      { mainCategory: "국내자산", subCategory: "국내배당", generation: "Domestic", country: "한국", name: "KODEX 금융고배당TOP10타겟위클리커버드콜", code: "498410", fee: "0.39%", yield: "15%", listingDate: "24.12", notes: "주식배당(7%), 옵션프리미엄(10%)" },
      { mainCategory: "국내자산", subCategory: "국내배당", generation: "Domestic", country: "한국", name: "TIMEFOLIO Korea플러스배당액티브", code: "441800", fee: "0.80%", yield: "10%+", listingDate: "22.09", isFavorite: true },
      // 국내자산 - KOSPI200
      { mainCategory: "국내자산", subCategory: "KOSPI200", generation: "Domestic", country: "한국", name: "RISE200위클리커버드콜", code: "475720", fee: "0.30%", yield: "18%(추정)", listingDate: "24.03", notes: "시가총액 높으나 수익률 좋지 않음" },
      { mainCategory: "국내자산", subCategory: "KOSPI200", generation: "Domestic", country: "한국", name: "KODEX 200타겟위클리커버드콜", code: "498400", fee: "0.39%", yield: "15%", listingDate: "24.12" },
      // 국내자산 - 국내채권
      { mainCategory: "국내자산", subCategory: "국내채권", generation: "Domestic", country: "한국", name: "TIGER CD금리플러스액티브(합성)", code: "499660", fee: "0.0098%", yield: "CD금리+알파", listingDate: "24.12" },
      { mainCategory: "국내자산", subCategory: "국내채권", generation: "Domestic", country: "한국", name: "KODEX KOFR 금리액티브(합성)", code: "423160", fee: "0.05%", yield: "-", listingDate: "22.04" },
      // 국내자산 - 리츠
      { mainCategory: "국내자산", subCategory: "리츠", generation: "Domestic", country: "한국", name: "TIGER 리츠부동산인프라", code: "329200", fee: "0.08%", yield: ">9%", listingDate: "19.07" },
      { mainCategory: "국내자산", subCategory: "리츠", generation: "Domestic", country: "한국", name: "KODEX 한국부동산리츠인프라", code: "476800", fee: "0.09%", yield: ">9%", listingDate: "24.03" },
      // 국내자산 - 국내섹터
      { mainCategory: "국내자산", subCategory: "국내섹터", generation: "Domestic", country: "한국", name: "KODEX 로봇액티브", code: "445290", fee: "0.50%", yield: "<1%", listingDate: "22.11" },
      { mainCategory: "국내자산", subCategory: "국내섹터", generation: "Domestic", country: "한국", name: "SOL 코리아메가테크액티브", code: "444200", fee: "0.55%", yield: "-", listingDate: "22.10", notes: "25년 수익률 115.9%" },
    ];

    for (const seed of seeds) {
      await storage.createEtf(seed);
    }
    console.log(`Seeded ${seeds.length} ETFs to database`);
  }
}
