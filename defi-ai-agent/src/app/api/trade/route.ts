/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/defi/trading/route.ts
import { queryLLM } from '@/utils/ai';
import { formatTradingPrompt } from '@/utils/prompt';
import { NextResponse } from 'next/server';

async function getTradingData() {
  try {
    const response = await fetch('https://api.llama.fi/overview/dexs');
    const dexData = await response.json();
    return dexData.filter((dex: any) =>
      dex.chain?.toLowerCase().includes("arbitrum")
    );
  } catch (error) {
    console.error('DefiLlama Trading API Error:', error);
    throw new Error('Failed to fetch trading data from DefiLlama');
  }
}

export async function GET() {
  try {
    const tradingData = await getTradingData();
    const formattedData = JSON.stringify(tradingData, null, 2);
    const formattedPrompt = formatTradingPrompt(formattedData);
    const analysis = await queryLLM(formattedPrompt);
    return NextResponse.json({ data: analysis });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}