import axios from "axios";

const PRODUCTION_URL = process.env.PRODUCTION_URL;
const DEV_URL = process.env.DEV_URL || "http://localhost:5000";

async function syncFromProduction() {
  if (!PRODUCTION_URL) {
    console.error("Error: PRODUCTION_URL environment variable is not set");
    console.log("Please set PRODUCTION_URL to your production app URL (e.g., https://your-app.replit.app)");
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting sync from production...`);
  console.log(`Production URL: ${PRODUCTION_URL}`);
  console.log(`Dev URL: ${DEV_URL}`);

  try {
    console.log("Fetching data from production...");
    const exportResponse = await axios.get(`${PRODUCTION_URL}/api/export`, {
      timeout: 30000,
    });

    if (!exportResponse.data?.data || !Array.isArray(exportResponse.data.data)) {
      throw new Error("Invalid export response format");
    }

    const etfData = exportResponse.data.data;
    console.log(`Fetched ${etfData.length} ETFs from production`);

    console.log("Importing data to development...");
    const importResponse = await axios.post(
      `${DEV_URL}/api/import`,
      { data: etfData },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000,
      }
    );

    console.log(`Import result: ${importResponse.data.message}`);
    console.log(`[${new Date().toISOString()}] Sync completed successfully!`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Sync failed: ${error.message}`);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data:`, error.response.data);
      }
    } else {
      console.error("Sync failed:", error);
    }
    process.exit(1);
  }
}

syncFromProduction();
