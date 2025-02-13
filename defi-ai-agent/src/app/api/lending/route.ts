/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { queryLLM } from '@/utils/ai';
import { formatLendingPrompt } from '@/utils/prompt';

async function getLendingProtocols() {
  try {
    const response = await fetch('https://api.llama.fi/protocols');
    const protocols = await response.json();

    const arbitrumProtocols = protocols.filter((protocol: any) => {
      const chainString = protocol.chain?.toLowerCase() || "";
      const chainsArray = Array.isArray(protocol.chains) &&
        protocol.chains.map((chain: string) => chain.toLowerCase());
      return chainString.includes("arbitrum") ||
        (chainsArray && chainsArray.some((chain: string) => chain.includes("arbitrum")));
    });

    return arbitrumProtocols.filter((protocol: any) => {
      const categoryLower = protocol.category?.toLowerCase() || "";
      return categoryLower.includes("lending") && protocol.tvl;
    });
  } catch (error) {
    console.error('DefiLlama Lending API Error:', error);
    throw new Error('Failed to fetch lending protocols from DefiLlama');
  }
}

export async function GET() {
  try {
    const lendingProtocols = await getLendingProtocols();
    const formattedData = JSON.stringify(lendingProtocols, null, 2);
    const formattedPrompt = formatLendingPrompt(formattedData);
    const analysis = await queryLLM(formattedPrompt);
    return NextResponse.json({ data: analysis });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}