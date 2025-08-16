import axios, { AxiosError } from "axios";
import { IExchangeRepository } from "../../types";
import { StandardPair, StandardTicker, AssetStatus } from "../../types";

// Type definition for the raw pair data from the KuCoin API.
interface KucoinRawPair {
  symbol: string;
  enableTrading: boolean;
  baseCurrency: string;
  quoteCurrency: string;
}

// Type definition for the raw ticker data from the KuCoin API.
interface KucoinRawTicker {
  price: string;
  bestBid: string;
  bestAsk: string;
}

// Type definition for a single network chain from the KuCoin API.
interface KucoinChain {
  chainName: string;
  isDepositEnabled: boolean;
  isWithdrawEnabled: boolean;
}

// Type definition for the currency details response from the KuCoin API.
interface KucoinCurrencyDetails {
  chains: KucoinChain[];
}

/**
 * Implements the IExchangeRepository interface for the KuCoin exchange.
 * This class handles all the logic for fetching market data and asset statuses
 * from the KuCoin API.
 */
class KucoinApi implements IExchangeRepository {
  // Public API Endpoints for KuCoin
  private readonly SYMBOLS_URL = "https://api.kucoin.com/api/v1/symbols";
  private readonly TICKER_URL =
    "https://api.kucoin.com/api/v1/market/orderbook/level1";
  private readonly CURRENCY_DETAIL_URL =
    "https://api.kucoin.com/api/v3/currencies";

  /**
   * Fetches all available trading pairs from the KuCoin exchange.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  public async fetchAllPairs(): Promise<StandardPair[]> {
    try {
      console.log("Fetching pairs from KuCoin (via Axios)...");
      const response = await axios.get<{ data: KucoinRawPair[] }>(
        this.SYMBOLS_URL
      );

      if (
        !response.data ||
        !response.data.data ||
        !Array.isArray(response.data.data)
      ) {
        throw new Error(
          "Unexpected response format from KuCoin API (fetchAllPairs)"
        );
      }

      const rawPairs = response.data.data;
      const pairs: StandardPair[] = rawPairs
        .filter((market) => market.enableTrading === true)
        .map((market) => ({
          symbol: market.symbol.replace("-", "/"),
          base: market.baseCurrency,
          quote: market.quoteCurrency,
          exchange: "kucoin",
          raw: market,
        }));

      console.log(`Found ${pairs.length} pairs on KuCoin.`);
      return pairs;
    } catch (error) {
      console.error(
        "Error fetching pairs from KuCoin:",
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
      const response = await axios.get<{ data: KucoinRawTicker }>(
        this.TICKER_URL,
        { params: { symbol: apiSymbol } }
      );
      const ticker = response.data.data;

      if (!ticker) {
        throw new Error(
          `KuCoin API returned null ticker data for ${apiSymbol}.`
        );
      }

      return {
        exchange: "kucoin",
        price: parseFloat(ticker.price),
        bid: parseFloat(ticker.bestBid),
        ask: parseFloat(ticker.bestAsk),
        raw: ticker,
      };
    } catch (error) {
      console.error(
        `Detailed error fetching ticker for ${apiSymbol} on KuCoin:`,
        (error as Error).message
      );
      if (axios.isAxiosError(error) && error.response) {
        console.error("API Response:", error.response.data);
      }
      return null;
    }
  }

  /**
   * Fetches the deposit and withdrawal status for a specific asset.
   * KuCoin's API allows fetching details for a single currency, which is efficient.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found.
   */
  public async getAssetStatus(asset: string): Promise<AssetStatus | null> {
    try {
      const url = `${this.CURRENCY_DETAIL_URL}/${asset.toUpperCase()}`;
      const response = await axios.get<{
        code: string;
        data: KucoinCurrencyDetails;
        msg?: string;
      }>(url);

      if (response.data.code !== "200000" || !response.data.data) {
        // This is not a critical error if the asset is simply not found.
        if (response.data.code !== "404") {
          console.error(
            `Invalid response from KuCoin V3 currencies API for ${asset}: ${
              response.data.msg || "No error message."
            }`
          );
        }
        return null;
      }

      const currencyDetails = response.data.data;
      const depositNetworks = (currencyDetails.chains ?? [])
        .filter((chain) => chain.isDepositEnabled)
        .map((chain) => chain.chainName.toUpperCase());
      const withdrawNetworks = (currencyDetails.chains ?? [])
        .filter((chain) => chain.isWithdrawEnabled)
        .map((chain) => chain.chainName.toUpperCase());

      return {
        canDeposit: depositNetworks.length > 0,
        canWithdraw: withdrawNetworks.length > 0,
        depositNetworks: depositNetworks,
        withdrawNetworks: withdrawNetworks,
        assetInfo: currencyDetails,
      };
    } catch (error) {
      // Avoid logging 404s as they are expected for non-existent assets.
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        console.error(
          `Detailed error fetching status for ${asset} on KuCoin (V3):`,
          (error as Error).message
        );
        console.error("API Response:", error.response?.data);
      }
      return null;
    }
  }
}

export default new KucoinApi();
