import axios, { AxiosError } from "axios";
import * as crypto from "crypto";
import * as qs from "qs";
import { IExchangeRepository } from "../../types";
import { StandardPair, StandardTicker, AssetStatus } from "../../types/";

// Type definition for the public asset pairs endpoint response.
interface KrakenAssetPairsResponse {
  error: any[];
  result: Record<string, KrakenRawPair>;
}

// Type definition for a single raw pair from the Kraken API.
interface KrakenRawPair {
  altname: string;
  wsname?: string;
}

// Type definition for the public ticker endpoint response.
interface KrakenTickerResponse {
  error: any[];
  result: Record<string, KrakenRawTicker>;
}

// Type definition for a single raw ticker from the Kraken API.
interface KrakenRawTicker {
  a: [string, number, string]; // Ask price array
  b: [string, number, string]; // Bid price array
  c: [string, string]; // Last trade closed array
}

// Generic type for a private Kraken API response.
interface KrakenApiResponse<T> {
  error: string[];
  result: T;
}

// Type definition for asset deposit/withdrawal methods.
interface KrakenAssetMethod {
  method: string;
  limit: any;
  fee: string;
}

/**
 * Implements the IExchangeRepository interface for the Kraken exchange.
 * This class handles all the logic for fetching market data and asset statuses
 * from the Kraken API, including handling its unique authentication mechanism.
 */
class KrakenApi implements IExchangeRepository {
  // API Endpoints
  private readonly BASE_URL = "https://api.kraken.com";
  private readonly ASSET_PAIRS_URL = "/0/public/AssetPairs";
  private readonly TICKER_URL = "/0/public/Ticker";
  private readonly DEPOSIT_METHODS_URL = "/0/private/DepositMethods";

  // API Credentials
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;

  // Nonce for managing private API requests
  private nonce: number;

  constructor() {
    this.apiKey = process.env.KRAKEN_KEY;
    this.apiSecret = process.env.KRAKEN_SECRET;
    this.nonce = Date.now() * 1000;
  }

  /**
   * Fetches all available trading pairs from the Kraken exchange.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  public async fetchAllPairs(): Promise<StandardPair[]> {
    try {
      console.log("Fetching pairs from Kraken (via Axios)...");
      const response = await axios.get<KrakenAssetPairsResponse>(
        `${this.BASE_URL}${this.ASSET_PAIRS_URL}`
      );
      if (response.data.error?.length > 0 || !response.data.result) {
        throw new Error(
          `Kraken API Error: ${JSON.stringify(response.data.error)}`
        );
      }
      const rawPairsObject = response.data.result;
      const pairs: StandardPair[] = Object.values(rawPairsObject)
        .filter((market) => !!market.wsname)
        .map((market) => {
          const symbol = market.wsname!;
          const [base, quote] = symbol.split("/");
          return { symbol, base, quote, exchange: "kraken", raw: market };
        });
      console.log(`Found ${pairs.length} pairs on Kraken.`);
      return pairs;
    } catch (error) {
      console.error(
        "Error fetching pairs from Kraken:",
        (error as Error).message
      );
      return [];
    }
  }

  /**
   * Fetches the latest price data (ticker) for a specific trading pair,
   * trying multiple symbol formats to handle API inconsistencies.
   * @param pair The standardized pair object for which to fetch the ticker.
   * @returns A promise that resolves to a standardized ticker object, or null if not found.
   */
  public async fetchTicker(pair: StandardPair): Promise<StandardTicker | null> {
    const primaryApiSymbol = pair.raw.altname;
    const secondaryApiSymbol = pair.symbol.replace("/", "");
    const symbolsToTry = [...new Set([primaryApiSymbol, secondaryApiSymbol])];

    for (const apiSymbol of symbolsToTry) {
      try {
        const response = await axios.get<KrakenTickerResponse>(
          `${this.BASE_URL}${this.TICKER_URL}`,
          { params: { pair: apiSymbol } }
        );
        if (response.data.error?.length > 0) {
          continue;
        }
        const tickerData = response.data.result[apiSymbol];
        if (tickerData) {
          return {
            exchange: "kraken",
            price: parseFloat(tickerData.c[0]),
            bid: parseFloat(tickerData.b[0]),
            ask: parseFloat(tickerData.a[0]),
            raw: tickerData,
          };
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          const errorString = JSON.stringify(error.response.data.error);
          if (!errorString.includes("EQuery:Unknown asset pair")) {
            console.error(
              `Error fetching ticker for ${apiSymbol} on Kraken:`,
              (error as Error).message
            );
          }
        }
        continue;
      }
    }
    return null;
  }

  /**
   * Fetches the deposit and withdrawal status for a specific asset using a
   * signed request to the Kraken API.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found.
   */
  public async getAssetStatus(asset: string): Promise<AssetStatus | null> {
    if (!this.apiKey || !this.apiSecret) {
      console.warn(
        "Kraken API keys not configured. Skipping wallet status check."
      );
      return null;
    }
    try {
      const depositResponse = await this._makeSignedRequest<
        KrakenAssetMethod[]
      >(this.DEPOSIT_METHODS_URL, { asset });
      const depositMethods = depositResponse.result || [];
      const depositNetworks = depositMethods.map((m) => m.method);
      const canDeposit = depositNetworks.length > 0;
      // As a simplification, we assume withdrawal is possible if deposit is.
      // A full implementation might also call a "WithdrawMethods" endpoint.
      const canWithdraw = canDeposit;
      const withdrawNetworks = depositNetworks;
      return {
        canDeposit,
        canWithdraw,
        depositNetworks,
        withdrawNetworks,
        assetInfo: { depositMethods: depositMethods },
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Creates and executes a signed POST request for the Kraken private API.
   * @param path The API endpoint path.
   * @param params The request body parameters.
   * @private
   */
  private async _makeSignedRequest<T>(
    path: string,
    params: Record<string, any>
  ): Promise<KrakenApiResponse<T>> {
    this.nonce++;
    const nonceStr = this.nonce.toString();
    const postData = qs.stringify({ nonce: nonceStr, ...params });
    const message =
      path +
      crypto
        .createHash("sha256")
        .update(nonceStr + postData)
        .digest("binary");
    const secret = Buffer.from(this.apiSecret!, "base64");
    const signature = crypto
      .createHmac("sha512", secret)
      .update(message, "binary")
      .digest("base64");
    const url = `${this.BASE_URL}${path}`;

    try {
      const { data } = await axios.post<KrakenApiResponse<T>>(url, postData, {
        headers: {
          "API-Key": this.apiKey,
          "API-Sign": signature,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (data.error && data.error.length > 0) {
        if (!data.error.join(",").includes("Unknown asset")) {
          console.error(`Kraken API Error at ${path}:`, data.error.join(", "));
        }
        throw new Error(data.error.join(", "));
      }
      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data?.error?.length > 0
      ) {
        if (!error.response.data.error.join(",").includes("Unknown asset")) {
          console.error(
            `Detailed Kraken API Error at ${path}:`,
            error.response.data.error.join(", ")
          );
        }
      }
      throw error;
    }
  }
}

export default new KrakenApi();
