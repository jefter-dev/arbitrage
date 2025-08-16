import { StandardPair, StandardTicker } from "./domain.types";

export type ExchangeName = string;

export interface ExchangeData {
  name: ExchangeName;
  pairs: StandardPair[];
}

export interface SharedPairInfo {
  symbol: string;
  exchanges: {
    name: ExchangeName;
    pairData: StandardPair;
  }[];
}

export interface EnrichedPair extends SharedPairInfo {
  tickers: Map<ExchangeName, StandardTicker>;
}
