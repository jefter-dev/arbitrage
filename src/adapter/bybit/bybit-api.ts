import axios, { AxiosError } from "axios";
import * as crypto from "crypto";
import { IExchangeRepository } from "../../types";
import { StandardPair, StandardTicker, AssetStatus } from "../../types/";

// Generic type for the Bybit V5 API response structure.
interface BybitBaseResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time: number;
}

// Type definition for the raw pair data from the Bybit API.
interface BybitRawPair {
  symbol: string;
  status: "Trading" | string;
  baseCoin: string;
  quoteCoin: string;
}

// Type definition for the raw ticker data from the Bybit API.
interface BybitRawTicker {
  symbol: string;
  bid1Price: string;
  ask1Price: string;
}

// Type definition for a single network chain from the Bybit API.
interface BybitChainInfo {
  chainType: string;
  chainDeposit: "1" | "0";
  chainWithdraw: "1" | "0";
}

// Type definition for the raw coin info data from the Bybit API.
interface BybitCoinInfo {
  coin: string;
  chains: BybitChainInfo[];
}

/**
 * Implements the IExchangeRepository interface for the Bybit exchange.
 * This class handles all the logic for fetching market data and asset statuses
 * from the Bybit API.
 */
class BybitApi implements IExchangeRepository {
  // API Endpoints
  private readonly BASE_URL = "https://api.bybit.com";
  private readonly INSTRUMENTS_URL = "/v5/market/instruments-info";
  private readonly TICKER_URL = "/v5/market/tickers";
  private readonly ALL_COINS_URL = "/v5/asset/coin/query-info";

  // API Credentials
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;

  constructor() {
    this.apiKey = process.env.BYBIT_KEY;
    this.apiSecret = process.env.BYBIT_SECRET;
  }

  /**
   * Fetches all available trading pairs from the Bybit exchange.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  public async fetchAllPairs(): Promise<StandardPair[]> {
    try {
      console.log("Fetching pairs from Bybit (via Axios)...");
      const response = await axios.get<
        BybitBaseResponse<{ list: BybitRawPair[] }>
      >(`${this.BASE_URL}${this.INSTRUMENTS_URL}`, {
        params: { category: "spot" },
      });

      if (
        response.data.retCode !== 0 ||
        !response.data.result ||
        !Array.isArray(response.data.result.list)
      ) {
        throw new Error(
          `Bybit API Error: ${response.data.retMsg}` ||
            "Unexpected response format (fetchAllPairs)"
        );
      }

      const rawPairs = response.data.result.list;
      const pairs: StandardPair[] = rawPairs
        .filter((market) => market.status === "Trading")
        .map((market) => ({
          symbol: `${market.baseCoin}/${market.quoteCoin}`,
          base: market.baseCoin,
          quote: market.quoteCoin,
          exchange: "bybit",
          raw: market,
        }));

      console.log(`Found ${pairs.length} pairs on Bybit.`);
      return pairs;
    } catch (error) {
      console.error(
        "Error fetching pairs from Bybit:",
        (error as Error).message
      );
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
      const response = await axios.get<
        BybitBaseResponse<{ list: BybitRawTicker[] }>
      >(`${this.BASE_URL}${this.TICKER_URL}`, {
        params: { category: "spot", symbol: apiSymbol },
      });

      if (
        response.data.retCode !== 0 ||
        !response.data.result ||
        !Array.isArray(response.data.result.list) ||
        response.data.result.list.length === 0
      ) {
        throw new Error(
          `Bybit API did not return ticker data for ${apiSymbol}`
        );
      }

      const ticker = response.data.result.list[0];
      return {
        exchange: "bybit",
        price: parseFloat(ticker.ask1Price),
        bid: parseFloat(ticker.bid1Price),
        ask: parseFloat(ticker.ask1Price),
        raw: ticker,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching ticker for ${apiSymbol} on Bybit:`,
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
   * signed request to the Bybit API.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found.
   */
  public async getAssetStatus(asset: string): Promise<AssetStatus | null> {
    if (!this.apiKey || !this.apiSecret) {
      console.warn(
        "Bybit API keys not configured. Skipping wallet status check."
      );
      return null;
    }
    try {
      const responseData = await this._makeSignedRequest<{
        rows: BybitCoinInfo[];
      }>(this.ALL_COINS_URL);
      const allCoins = responseData.result.rows;

      const assetInfo = allCoins.find(
        (c) => c.coin.toUpperCase() === asset.toUpperCase()
      );

      if (!assetInfo) {
        return null;
      }

      const depositNetworks = (assetInfo.chains ?? [])
        .filter((chain) => chain.chainDeposit === "1")
        .map((chain) => chain.chainType.toUpperCase());

      const withdrawNetworks = (assetInfo.chains ?? [])
        .filter((chain) => chain.chainWithdraw === "1")
        .map((chain) => chain.chainType.toUpperCase());

      return {
        canDeposit: depositNetworks.length > 0,
        canWithdraw: withdrawNetworks.length > 0,
        depositNetworks: depositNetworks,
        withdrawNetworks: withdrawNetworks,
        assetInfo: assetInfo,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching status for ${asset} on Bybit:`,
        (error as Error).message
      );
      return null;
    }
  }

  /**
   * Creates and executes a signed GET request for the Bybit V5 API.
   * @param endpoint The API endpoint path.
   * @param params The request query parameters.
   * @private
   */
  private async _makeSignedRequest<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<BybitBaseResponse<T>> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        "Bybit API keys are not configured for a signed request."
      );
    }

    const timestamp = Date.now().toString();
    const recvWindow = "5000";
    const paramStr = new URLSearchParams(params).toString();
    const stringToSign = timestamp + this.apiKey + recvWindow + paramStr;
    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(stringToSign)
      .digest("hex");

    const headers = {
      "X-BAPI-API-KEY": this.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-SIGN": signature,
      "X-BAPI-RECV-WINDOW": recvWindow,
    };

    const url = `${this.BASE_URL}${endpoint}${paramStr ? "?" + paramStr : ""}`;
    const { data } = await axios.get<BybitBaseResponse<T>>(url, { headers });

    if (data.retCode !== 0) {
      throw new Error(`Bybit API Error: ${data.retMsg}`);
    }

    return data;
  }
}

export default new BybitApi();
