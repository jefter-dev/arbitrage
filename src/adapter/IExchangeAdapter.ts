import { AssetStatus, StandardPair, StandardTicker } from "../types";

/**
 * Defines the contract for an exchange adapter, which acts as a repository
 * for fetching data from a specific cryptocurrency exchange. Any class that
 * communicates with an exchange must implement this interface.
 */
export interface IExchangeRepository {
  // Note: I've kept the name IExchangeRepository as it's more aligned with your architecture
  /**
   * Fetches all available trading pairs from the exchange.
   * @returns A promise that resolves to an array of standardized trading pairs.
   */
  fetchAllPairs(): Promise<StandardPair[]>;

  /**
   * Fetches the latest price data (ticker) for a specific trading pair.
   * @param pair The standardized pair object for which to fetch the ticker.
   * @returns A promise that resolves to a standardized ticker object, or null if not found.
   */
  fetchTicker(pair: StandardPair): Promise<StandardTicker | null>;

  /**
   * Fetches the deposit and withdrawal status for a specific asset (currency).
   * This includes checking network availability and wallet status.
   * @param asset The symbol of the asset to check (e.g., "BTC", "USDT").
   * @returns A promise that resolves to an asset status object, or null if not found or not supported.
   */
  getAssetStatus(asset: string): Promise<AssetStatus | null>;
}
