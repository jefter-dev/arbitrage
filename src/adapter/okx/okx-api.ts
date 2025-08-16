import axios, { AxiosError } from "axios";
import * as crypto from "crypto";
import { IExchangeRepository } from "../../types";
import { StandardPair, StandardTicker, AssetStatus } from "../../types/";

// Generic type for the OKX V5 API response structure.
interface OkxBaseResponse<T> {
  code: string; // "0" indicates success
  msg: string;
  data: T;
}

// Type definition for the raw pair data from the OKX API.
interface OkxRawPair {
  instId: string;
  state: "live" | string;
  baseCcy: string;
  quoteCcy: string;
}

// Type definition for the raw ticker data from the OKX API.
interface OkxRawTicker {
  instId: string;
  askPx: string;
  bidPx: string;
}

// Type definition for the currency info from the OKX assets API.
interface OkxCurrencyInfo {
  ccy: string;
  name: string;
  chain: string;
  canDep: boolean;
  canWd: boolean;
  minWd: string;
}

/**
 * Implements the IExchangeRepository interface for the OKX exchange.
 * This class handles all the logic for fetching market data and asset statuses
 * from the OKX API, including its specific authentication mechanism.
 */
class OkxApi implements IExchangeRepository {
  // API Endpoints
  private readonly BASE_URL = "https://www.okx.com";
  private readonly INSTRUMENTS_URL = "/api/v5/public/instruments";
  private readonly TICKER_URL = "/api/v5/market/ticker";
  private readonly CURRENCIES_URL = "/api/v5/asset/currencies";

  // API Credentials
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly apiPassphrase: string | undefined;

  constructor() {
    this.apiKey = process.env.OKX_KEY;
    this.apiSecret = process.env.OKX_SECRET;
    this.apiPassphrase = process.env.OKX_PASSPHRASE;
  }

  /**
   * Fetches all available trading pairs from the OKX exchange.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  public async fetchAllPairs(): Promise<StandardPair[]> {
    try {
      console.log("Fetching pairs from OKX (via Axios)...");
      const response = await axios.get<OkxBaseResponse<OkxRawPair[]>>(
        `${this.BASE_URL}${this.INSTRUMENTS_URL}`,
        { params: { instType: "SPOT" } }
      );
      if (
        response.data.code !== "0" ||
        !response.data.data ||
        !Array.isArray(response.data.data)
      ) {
        throw new Error(
          `OKX API Error: ${response.data.msg || "Unexpected response format"}`
        );
      }
      const rawPairs = response.data.data;
      const pairs: StandardPair[] = rawPairs
        .filter((market) => market.state === "live")
        .map((market) => ({
          symbol: market.instId.replace("-", "/"),
          base: market.baseCcy,
          quote: market.quoteCcy,
          exchange: "okx",
          raw: market,
        }));
      console.log(`Found ${pairs.length} pairs on OKX.`);
      return pairs;
    } catch (error) {
      console.error("Error fetching pairs from OKX:", (error as Error).message);
      return [];
    }
  }

  /**
   * Fetches the latest price data (ticker) for a specific trading pair.
   * @param pair The standardized pair object for which to fetch the ticker.
   * @returns A promise that resolves to a standardized ticker object, or null if not found.
   */
  public async fetchTicker(pair: StandardPair): Promise<StandardTicker | null> {
    const apiSymbol = pair.raw.instId;
    try {
      const response = await axios.get<OkxBaseResponse<OkxRawTicker[]>>(
        `${this.BASE_URL}${this.TICKER_URL}`,
        { params: { instId: apiSymbol } }
      );
      if (
        response.data.code !== "0" ||
        !response.data.data ||
        !Array.isArray(response.data.data) ||
        response.data.data.length === 0
      ) {
        throw new Error(`OKX API did not return ticker data for ${apiSymbol}`);
      }
      const ticker = response.data.data[0];
      return {
        exchange: "okx",
        price: parseFloat(ticker.askPx),
        bid: parseFloat(ticker.bidPx),
        ask: parseFloat(ticker.askPx),
        raw: ticker,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching ticker for ${apiSymbol} on OKX:`,
        (error as Error).message
      );
      if (axios.isAxiosError(error) && error.response) {
        console.error("API Response:", error.response.data);
      }
      return null;
    }
  }

  /**
   * Fetches the deposit and withdrawal status for a specific asset using a
   * signed request to the OKX API.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found.
   */
  public async getAssetStatus(asset: string): Promise<AssetStatus | null> {
    if (!this.apiKey || !this.apiSecret || !this.apiPassphrase) {
      console.warn("OKX API keys incomplete. Skipping wallet status check.");
      return null;
    }
    try {
      const response = await this._makeSignedRequest<OkxCurrencyInfo[]>(
        this.CURRENCIES_URL,
        { ccy: asset.toUpperCase() }
      );

      const assetNetworks = response.data;
      if (!assetNetworks || assetNetworks.length === 0) {
        return null; // Asset not found
      }

      const depositNetworks = assetNetworks
        .filter((n) => n.canDep)
        .map((n) => n.chain);
      const withdrawNetworks = assetNetworks
        .filter((n) => n.canWd)
        .map((n) => n.chain);

      return {
        canDeposit: depositNetworks.length > 0,
        canWithdraw: withdrawNetworks.length > 0,
        depositNetworks,
        withdrawNetworks,
        assetInfo: assetNetworks,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Creates and executes a signed GET request for the OKX V5 API.
   * @param path The API endpoint path.
   * @param params The request query parameters.
   * @private
   */
  private async _makeSignedRequest<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<OkxBaseResponse<T>> {
    const timestamp = new Date().toISOString();
    const method = "GET";
    const queryString =
      Object.keys(params).length > 0
        ? `?${new URLSearchParams(params).toString()}`
        : "";
    const requestPath = `${path}${queryString}`;

    const what = timestamp + method + requestPath;
    const signature = crypto
      .createHmac("sha256", this.apiSecret!)
      .update(what)
      .digest("base64");

    const url = `${this.BASE_URL}${requestPath}`;

    try {
      const { data } = await axios.get<OkxBaseResponse<T>>(url, {
        headers: {
          "OK-ACCESS-KEY": this.apiKey,
          "OK-ACCESS-SIGN": signature,
          "OK-ACCESS-TIMESTAMP": timestamp,
          "OK-ACCESS-PASSPHRASE": this.apiPassphrase,
          "Content-Type": "application/json",
        },
      });

      if (data.code !== "0") {
        // Suppress common errors like "Currency does not exist"
        if (!data.msg.includes("does not exist")) {
          console.error(`OKX API Error at ${path}: ${data.msg}`);
        }
        throw new Error(data.msg);
      }

      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (
          error.response.data?.msg &&
          !error.response.data.msg.includes("does not exist")
        ) {
          console.error(
            `Detailed OKX API Error at ${path}:`,
            error.response.data.msg
          );
        }
      }
      throw error;
    }
  }
}

export default new OkxApi();
