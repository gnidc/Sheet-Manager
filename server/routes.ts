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
        dailyChangeRate: change.toString(),
        lastUpdated: new Date()
      });

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to refresh price" });
    }
  });

  app.get(api.etfs.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const country = req.query.country as string | undefined;
    const assetClass = req.query.assetClass as string | undefined;
    const etfs = await storage.getEtfs({ search, category, country, assetClass });
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

  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getEtfs();
  if (existing.length === 0) {
    const seeds = [
      {
        assetClass: "해외.커버드콜",
        generation: "2세대",
        category: "미국국채",
        country: "미국",
        name: "TIGER 미국30년국채커버드콜액티브(H)",
        code: "476550",
        fee: "0.39%",
        yield: "12%(타겟)",
        marketCap: "1.1조/>100억",
        dividendCycle: "월지급(말일)",
        optionType: "위클리(30%)",
        underlyingAsset: "KEDI US Treasury 30Y Weekly Covered Call 30 Index",
        callOption: "TLT",
        listingDate: "24.02",
        notes: "환헷지",
        linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7476550009",
        linkBlog: "https://blog.naver.com/m_invest/223358405892"
      },
      {
        assetClass: "해외.커버드콜",
        generation: "2세대",
        category: "미국국채",
        country: "미국",
        name: "KODEX 미국30년국채타겟커버드콜(합성 H)",
        code: "481060",
        fee: "0.25%",
        yield: "12%(타겟)",
        marketCap: "4142억/50~150억",
        dividendCycle: "월지급(15일)",
        optionType: "위클리(30%)",
        underlyingAsset: "Bloomberg U.S.Treasury 20+ Year(TLT)+ 12% Premium Covered Call index(Total Return)",
        callOption: "TLT",
        listingDate: "24.04",
        notes: "환헷지/옵션매도비중조절",
        linkProduct: "https://www.samsungfund.com/etf/product/view.do?id=2ETFM9"
      },
      {
        assetClass: "해외.액티브",
        generation: "1세대",
        category: "나스닥100",
        country: "미국",
        name: "TIGER 미국나스닥100커버드콜(합성)",
        code: "441680",
        fee: "0.37%",
        yield: "12%(타겟)",
        marketCap: "3557억/10~50억",
        dividendCycle: "월지급(말일)",
        optionType: "Monthly타겟(~100%)",
        underlyingAsset: "CBOE Nasdaq-100 BuyWrite V2 지수(Total Return)(원화환산)",
        callOption: "ATM Nasdaq-100 콜옵션",
        listingDate: "22.09",
        linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7441680006"
      },
      {
        assetClass: "국내자산",
        generation: "3세대",
        category: "나스닥100",
        country: "미국",
        name: "TIGER 미국나스닥100타겟데일리커버드콜",
        code: "486290",
        fee: "0.25%",
        yield: "15%(타겟)",
        marketCap: "5092억/50~150억",
        dividendCycle: "월지급(말일)",
        optionType: "데일리타겟(15%+-)",
        underlyingAsset: "NASDAQ-100 Daily Covered Call Target Premium 15% 지수(Total Return)(원화환산)",
        callOption: "NASDAQ100 콜옵션",
        listingDate: "24.06",
        linkProduct: "https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR7486290000",
        linkBlog: "https://blog.naver.com/m_invest/223487037728?trackingCode=blog_bloghome_searchlist"
      }
    ];

    for (const seed of seeds) {
      await storage.createEtf(seed);
    }
  }
}
