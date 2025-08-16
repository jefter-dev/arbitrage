/**
 * Represents a found arbitrage opportunity with all necessary data.
 * This structure includes a well-defined validation object for enhanced clarity.
 */
export interface Opportunity {
  /** The trading pair symbol, e.g., "BTC/USDT". */
  pair: string;

  /** Expected profit percentage for this opportunity. */
  profitPercentage: number;

  /** Information about where to buy the asset. */
  buyAt: {
    exchange: string; // Exchange name where the asset should be bought
    price: number; // Current buy price
  };

  /** Information about where to sell the asset. */
  sellAt: {
    exchange: string; // Exchange name where the asset should be sold
    price: number; // Current sell price
  };

  /**
   * Optional field added during validation to provide more detailed data.
   */
  validation?: {
    /** Whether this opportunity is executable (all conditions met). */
    isExecutable: boolean;

    /** Networks that are common between the buy and sell exchanges. */
    commonNetworks: string[];

    /** Details about the buy exchange regarding withdrawals. */
    buyExchange: {
      canWithdraw: boolean;
      withdrawNetworks?: string[];
    };

    /** Details about the sell exchange regarding deposits. */
    sellExchange: {
      canDeposit: boolean;
      depositNetworks?: string[];
    };

    /** Raw asset information used for validation. */
    assetDetails?: {
      baseAsset: {
        buyExchange: any; // Raw data of the base asset on the buy exchange
        sellExchange: any; // Raw data of the base asset on the sell exchange
      };
      quoteAsset: {
        buyExchange: any; // Raw data of the quote asset on the buy exchange
        sellExchange: any; // Raw data of the quote asset on the sell exchange
      };
    };
  };
}
