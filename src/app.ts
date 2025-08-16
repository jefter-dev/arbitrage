import "dotenv/config";

// ╔══════════════════════════════════════════════════════╗
// ║                   🔧 CONFIGURATION                   ║
// ╚══════════════════════════════════════════════════════╝
// ------------------------------------------------------
// Here we define execution constants for the arbitrage
// application, such as the number of pairs to analyze
// and the minimum acceptable profit margin.
const INITIAL_QUANTITY_ANALYZED = parseInt(
  process.env.INITIAL_QUANTITY_ANALYZED || "0",
  10
);
const FINAL_QUANTITY_ANALYZED = parseInt(
  process.env.FINAL_QUANTITY_ANALYZED || "2000",
  10
);
const MIN_PROFIT_PERCENTAGE = parseFloat(
  process.env.MIN_PROFIT_PERCENTAGE || "0.35"
); // 0.35
const QUOTE_ASSETS_FILTER = process.env.QUOTE_ASSETS_FILTER
  ? process.env.QUOTE_ASSETS_FILTER.split(",")
  : ["USDT"];

import { ArbitrageConfig, IExchangeRepository } from "../src/types";

const arbitrageConfig: ArbitrageConfig = {
  minProfitPercentage: MIN_PROFIT_PERCENTAGE,
  // quoteAssetsFilter: QUOTE_ASSETS_FILTER,   // can be enabled in the future
};

// ╔══════════════════════════════════════════════════════╗
// ║                 🔌 EXCHANGE ADAPTERS                 ║
// ╚══════════════════════════════════════════════════════╝
import binanceAdapter from "./adapter/binance/binance-api";
import kucoinAdapter from "./adapter/kucoin/kucoin-api";
import bitgetAdapter from "./adapter/bitget/bitget-api";
import mexcAdapter from "./adapter/mexc/mexc-api";
import bybitAdapter from "./adapter/bybit/bybit-api";
import coinbaseAdapter from "./adapter/coinbase/coinbase-api";
import krakenAdapter from "./adapter/kraken/kraken-api";
import okxAdapter from "./adapter/okx/okx-api";

// List of enabled exchanges for analysis
const exchangesToUse: { name: string; instance: IExchangeRepository }[] = [
  { name: "binance", instance: binanceAdapter },
  { name: "bybit", instance: bybitAdapter },
  { name: "kucoin", instance: kucoinAdapter },
  { name: "bitget", instance: bitgetAdapter },
  { name: "mexc", instance: mexcAdapter },
  { name: "coinbase", instance: coinbaseAdapter },
  { name: "kraken", instance: krakenAdapter },
  { name: "okx", instance: okxAdapter },
];

// ╔══════════════════════════════════════════════════════╗
// ║              🚀 APPLICATION STARTUP                  ║
// ╚══════════════════════════════════════════════════════╝
import { ArbitrageFacade } from "./facade/arbitrage.facade";

async function main() {
  console.log("--- Starting Application ---");
  const arbitrageFacade = new ArbitrageFacade(exchangesToUse, arbitrageConfig);
  await arbitrageFacade.run(INITIAL_QUANTITY_ANALYZED, FINAL_QUANTITY_ANALYZED);
}

main().catch((error) => {
  console.error(
    "A fatal and unexpected error occurred during main execution:",
    error
  );
  process.exit(1);
});
