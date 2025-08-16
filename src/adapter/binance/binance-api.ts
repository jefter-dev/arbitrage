// src/adapters/binance.ts

import axios, { AxiosError } from "axios";
import * as crypto from "crypto";
import { IExchangeRepository } from "../../types";
import { StandardPair, StandardTicker, AssetStatus } from "../../types";

// Type definition for the raw pair data from the Binance API.
interface BinanceRawPair {
  symbol: string;
  status: string;
  isSpotTradingAllowed: boolean;
  baseAsset: string;
  quoteAsset: string;
}

// Type definition for the raw ticker data from the Binance API.
interface BinanceRawTicker {
  symbol: string;
  bidPrice: string;
  askPrice: string;
}

// Type definition for the raw asset configuration from the Binance API.
interface BinanceAssetConfig {
  coin: string;
  networkList: {
    network: string;
    depositEnable: boolean;
    withdrawEnable: boolean;
  }[];
}

/**
 * Implements the IExchangeRepository interface for the Binance exchange.
 * This class handles all the logic for fetching market data and asset statuses
 * from the Binance API.
 */
class BinanceApi implements IExchangeRepository {
  // Public API Endpoints
  public readonly EXCHANGE_INFO_URL =
    "https://api.binance.com/api/v3/exchangeInfo";
  public readonly TICKER_URL =
    "https://api.binance.com/api/v3/ticker/bookTicker";

  // Authenticated API Endpoints
  private readonly BASE_SAPI_URL = "https://api.binance.com";
  private readonly ASSET_CONFIG_ENDPOINT = "/sapi/v1/capital/config/getall";

  // API Credentials
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;

  constructor() {
    this.apiKey = process.env.BINANCE_KEY;
    this.apiSecret = process.env.BINANCE_SECRET;
  }

  /**
   * Fetches all available trading pairs from the Binance exchange.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  public async fetchAllPairs(): Promise<StandardPair[]> {
    try {
      console.log("Fetching pairs from Binance (via Axios)...");
      const response = await axios.get<{ symbols: BinanceRawPair[] }>(
        this.EXCHANGE_INFO_URL
      );

      if (
        !response.data ||
        !response.data.symbols ||
        !Array.isArray(response.data.symbols)
      ) {
        throw new Error("Unexpected response format from Binance API");
      }

      const rawPairs = response.data.symbols;

      const pairs: StandardPair[] = rawPairs
        .filter(
          (market) =>
            market.status === "TRADING" && market.isSpotTradingAllowed === true
        )
        .map((market) => ({
          symbol: `${market.baseAsset}/${market.quoteAsset}`,
          base: market.baseAsset,
          quote: market.quoteAsset,
          exchange: "binance",
          raw: market,
        }));

      console.log(`Found ${pairs.length} pairs on Binance.`);
      return pairs;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error(
          "Network or API error from Binance (via Axios):",
          error.response.data || error.message
        );
      } else {
        console.error(
          "Error processing data from Binance:",
          (error as Error).message
        );
      }
      return [];
    }
  }

  /**
   * Fetches the latest price data (ticker) for a specific trading pair.
   * @param pair The standardized pair object for which to fetch the ticker.
   * @returns A promise that resolves to a standardized ticker object, or null if not found.
   */
  public async fetchTicker(pair: StandardPair): Promise<StandardTicker | null> {
    const apiSymbol = pair.raw.symbol;
    try {
      const response = await axios.get<BinanceRawTicker>(this.TICKER_URL, {
        params: { symbol: apiSymbol },
      });
      const ticker = response.data;

      return {
        exchange: "binance",
        price: parseFloat(ticker.askPrice),
        bid: parseFloat(ticker.bidPrice),
        ask: parseFloat(ticker.askPrice),
        raw: ticker,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching ticker for ${apiSymbol} on Binance:`,
        (error as Error).message
      );
      if (axios.isAxiosError(error) && error.response) {
        console.error("API Response:", error.response.data);
      }
      return null;
    }
  }

  /**
   * Fetches the deposit and withdrawal status for a specific asset by querying
   * the authenticated endpoint for all asset configurations.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found.
   */
  public async getAssetStatus(asset: string): Promise<AssetStatus | null> {
    if (!this.apiKey || !this.apiSecret) {
      console.warn(
        "Binance API keys not configured. Skipping wallet status check."
      );
      return null;
    }

    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = crypto
        .createHmac("sha256", this.apiSecret)
        .update(queryString)
        .digest("hex");

      const { data: allAssetsFromApi } = await axios.get<BinanceAssetConfig[]>(
        `${this.BASE_SAPI_URL}${this.ASSET_CONFIG_ENDPOINT}?${queryString}&signature=${signature}`,
        { headers: { "X-MBX-APIKEY": this.apiKey } }
      );

      const assetInfo = allAssetsFromApi.find(
        (item) => item.coin.toUpperCase() === asset.toUpperCase()
      );

      if (!assetInfo) {
        return null;
      }

      const depositNetworks = assetInfo.networkList
        .filter((n) => n.depositEnable)
        .map((n) => n.network);
      const withdrawNetworks = assetInfo.networkList
        .filter((n) => n.withdrawEnable)
        .map((n) => n.network);

      return {
        canDeposit: depositNetworks.length > 0,
        canWithdraw: withdrawNetworks.length > 0,
        depositNetworks,
        withdrawNetworks,
        assetInfo,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching status for ${asset} on Binance:`,
        axios.isAxiosError(error) && error.response
          ? error.response.data
          : (error as Error).message
      );
      return null;
    }
  }
}

export default new BinanceApi();
