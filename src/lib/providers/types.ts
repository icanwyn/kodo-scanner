import type { Candle, DataAttribution, Quote } from "@/types";

export interface MarketProvider {
  name: string;
  getQuote(symbol: string): Promise<Quote | null>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getCandles(symbol: string, range?: string): Promise<Candle[] | null>;
  getMovers?(): Promise<string[]>;
  getNews?(symbol?: string): Promise<{ title: string; url?: string; source?: string; publishedAt?: string }[]>;
}

export function attribution(
  provider: string,
  delayed = true,
  delayMinutes = 15
): DataAttribution {
  return {
    provider,
    delayed,
    delayMinutes,
    fetchedAt: new Date().toISOString(),
  };
}
