import axios, { AxiosError } from "axios";
import * as crypto from "crypto";
import { IExchangeRepository } from "../../types";
import { StandardPair, StandardTicker, AssetStatus } from "../../types";

// Type definition for the raw pair data from the MEXC API.
interface MexcRawPair {
  symbol: string;
  status: "1" | "0";
  isSpotTradingAllowed: boolean;
  permissions: string[];
  baseAsset: string;
  quoteAsset: string;
}

// Type definition for the raw ticker data from the MEXC API.
interface MexcRawTicker {
  askPrice: string;
  bidPrice: string;
}

// Type definition for a single network from the MEXC API.
interface MexcNetworkInfo {
  network: string;
  depositEnable: boolean;
  withdrawEnable: boolean;
}

// Type definition for the raw coin info from the MEXC API.
interface MexcCoinInfo {
  coin: string;
  networkList: MexcNetworkInfo[];
}

// Type definition for a potential API error response from MEXC.
interface MexcApiError {
  code: number;
  msg: string;
}

/**
 * Implements the IExchangeRepository interface for the MEXC exchange.
 * This class handles all the logic for fetching market data and asset statuses
 * from the MEXC API, including signed requests for private endpoints.
 */
class MexcApi implements IExchangeRepository {
  // API Endpoints
  private readonly BASE_URL = "https://api.mexc.com";
  private readonly EXCHANGE_INFO_URL = "/api/v3/exchangeInfo";
  private readonly TICKER_URL = "/api/v3/ticker/bookTicker";
  private readonly CAPITAL_CONFIG_URL = "/api/v3/capital/config/getall";

  // API Credentials
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;

  constructor() {
    this.apiKey = process.env.MEXC_KEY;
    this.apiSecret = process.env.MEXC_SECRET;
  }

  /**
   * Fetches all available trading pairs from the MEXC exchange.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  public async fetchAllPairs(): Promise<StandardPair[]> {
    try {
      console.log("Fetching pairs from MEXC (via Axios)...");
      const response = await axios.get<{ symbols: MexcRawPair[] }>(
        `${this.BASE_URL}${this.EXCHANGE_INFO_URL}`
      );

      if (
        !response.data ||
        !response.data.symbols ||
        !Array.isArray(response.data.symbols)
      ) {
        throw new Error(
          "Unexpected response format from MEXC API (fetchAllPairs)"
        );
      }
      const rawPairs = response.data.symbols;

      const pairs: StandardPair[] = rawPairs
        .filter(
          (market) =>
            market.status === "1" &&
            market.isSpotTradingAllowed === true &&
            market.permissions?.includes("SPOT")
        )
        .map((market) => ({
          symbol: `${market.baseAsset}/${market.quoteAsset}`,
          base: market.baseAsset,
          quote: market.quoteAsset,
          exchange: "mexc",
          raw: market,
        }));

      console.log(`Found ${pairs.length} SPOT tradable pairs on MEXC.`);
      return pairs;
    } catch (error) {
      console.error(
        "Error fetching pairs from MEXC:",
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
      const response = await axios.get<MexcRawTicker>(
        `${this.BASE_URL}${this.TICKER_URL}`,
        { params: { symbol: apiSymbol } }
      );
      const ticker = response.data;

      return {
        exchange: "mexc",
        price: parseFloat(ticker.askPrice),
        bid: parseFloat(ticker.bidPrice),
        ask: parseFloat(ticker.askPrice),
        raw: ticker,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching ticker for ${apiSymbol} on MEXC:`,
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
   * signed request to the MEXC API.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found.
   */
  public async getAssetStatus(asset: string): Promise<AssetStatus | null> {
    if (!this.apiKey || !this.apiSecret) {
      console.warn(
        "MEXC API keys not configured. Skipping wallet status check."
      );
      return null;
    }
    try {
      const allAssets = await this._makeSignedRequest<MexcCoinInfo[]>(
        this.CAPITAL_CONFIG_URL
      );

      const assetInfo = allAssets.find(
        (c) => c.coin.toUpperCase() === asset.toUpperCase()
      );

      if (!assetInfo) {
        return null;
      }

      const depositNetworks = (assetInfo.networkList ?? [])
        .filter((net) => net.depositEnable)
        .map((net) => net.network.toUpperCase());

      const withdrawNetworks = (assetInfo.networkList ?? [])
        .filter((net) => net.withdrawEnable)
        .map((net) => net.network.toUpperCase());

      return {
        canDeposit: depositNetworks.length > 0,
        canWithdraw: withdrawNetworks.length > 0,
        depositNetworks,
        withdrawNetworks,
        assetInfo: assetInfo,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching status for ${asset} on MEXC:`,
        (error as Error).message
      );
      return null;
    }
  }

  /**
   * Creates and executes a signed GET request for the MEXC V3 API.
   * @param endpoint The API endpoint path.
   * @param params The request query parameters.
   * @private
   */
  private async _makeSignedRequest<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("MEXC API keys are not configured for a signed request.");
    }

    const timestamp = Date.now();
    const allParams = {
      ...params,
      timestamp: timestamp.toString(),
    };

    const queryString = new URLSearchParams(allParams).toString();
    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");

    const url = `${this.BASE_URL}${endpoint}?${queryString}&signature=${signature}`;

    const { data } = await axios.get<T | MexcApiError>(url, {
      headers: { "X-MEXC-APIKEY": this.apiKey },
    });

    if (
      data &&
      typeof data === "object" &&
      "code" in data &&
      (data as any).code !== undefined &&
      (data as any).code !== 200
    ) {
      throw new Error(
        `MEXC API Error: ${(data as MexcApiError).msg} (code: ${
          (data as MexcApiError).code
        })`
      );
    }

    return data as T;
  }
}

export default new MexcApi();
