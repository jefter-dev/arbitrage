/**
 * Represents a standardized trading pair, as returned by an `IExchangeRepository`.
 */
export interface StandardPair {
  /**
   * Full trading pair symbol, usually in the format "BASE/QUOTE" or "BASEQUOTE".
   * Example: "BTC/USDT" or "BTCUSDT".
   */
  symbol: string;

  /**
   * The base asset of the trading pair.
   * Example: In BTC/USDT, the base is "BTC".
   */
  base: string;

  /**
   * The quote asset of the trading pair.
   * Example: In BTC/USDT, the quote is "USDT".
   */
  quote: string;

  /**
   * The name or identifier of the exchange that provides this pair.
   * Example: "binance", "kucoin".
   */
  exchange: string;

  /**
   * Raw pair data returned directly by the exchange API.
   * Useful for cases where additional metadata is needed.
   */
  raw: any;
}

/**
 * Represents the price data of a trading pair at a given moment.
 */
export interface StandardTicker {
  /**
   * The name or identifier of the exchange where this ticker was fetched.
   */
  exchange: string;

  /**
   * The last traded price of the pair.
   */
  price: number;

  /**
   * The current highest bid price (buy order).
   */
  bid: number;

  /**
   * The current lowest ask price (sell order).
   */
  ask: number;

  /**
   * Raw ticker data returned directly by the exchange API.
   */
  raw: any;
}

/**
 * Represents the deposit and withdrawal status of an asset on a specific exchange.
 */
export interface AssetStatus {
  /**
   * Whether deposits are currently enabled for this asset.
   */
  canDeposit: boolean;

  /**
   * Whether withdrawals are currently enabled for this asset.
   */
  canWithdraw: boolean;

  /**
   * List of supported deposit networks (e.g., "ERC20", "BEP20").
   */
  depositNetworks: string[];

  /**
   * List of supported withdrawal networks (e.g., "ERC20", "TRC20").
   */
  withdrawNetworks: string[];

  /**
   * Raw asset information returned directly by the exchange API.
   */
  assetInfo: any;
}
