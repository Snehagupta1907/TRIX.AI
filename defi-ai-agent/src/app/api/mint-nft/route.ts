/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import Safe from "@safe-global/protocol-kit";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  encodeFunctionData,
  getContract,
} from "viem";
import { OperationType, MetaTransactionData } from "@safe-global/types-kit";
import { arbitrumSepolia } from "viem/chains";
import { AINFT_ADDRESS } from "@/lib/constants";
import { AINFT_ABI } from "@/lib/abi";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { SAFE_ADDRESS, SIGNER_PRIVATE_KEY, WALLET_ADDRESS, TOKEN_URI } = body;
    const RPC_URL = process.env.RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

    if (!SAFE_ADDRESS || !SIGNER_PRIVATE_KEY || !WALLET_ADDRESS || !TOKEN_URI) {
      return NextResponse.json(
        { error: "Missing required input or environment variables" },
        { status: 400 }
      );
    }

    const customChain = defineChain({
      ...arbitrumSepolia,
      name: "Arbitrum Sepolia",
      transport: http(RPC_URL),
    });

    const publicClient = createPublicClient({
      transport: http(RPC_URL),
      chain: customChain,
    });

    const walletClient = createWalletClient({
      transport: http(RPC_URL),
      chain: customChain,
    });

    const protocolKit = await Safe.init({
      provider: RPC_URL,
      signer: SIGNER_PRIVATE_KEY,
      safeAddress: SAFE_ADDRESS,
    });

    const isSafeDeployed = await protocolKit.isSafeDeployed();
    if (!isSafeDeployed) {
      return NextResponse.json(
        { error: "Safe not deployed" },
        { status: 400 }
      );
    }

    const callDataMint = encodeFunctionData({
      abi: AINFT_ABI,
      functionName: "mintNft",
      args: [WALLET_ADDRESS, TOKEN_URI],
    });

    const safeMintTx: MetaTransactionData = {
      to: AINFT_ADDRESS,
      value: "0",
      data: callDataMint,
      operation: OperationType.Call,
    };

    const safeTx = await protocolKit.createTransaction({
      transactions: [safeMintTx],
      onlyCalls: true,
    });

    const txResponse = await protocolKit.executeTransaction(safeTx);
    await publicClient.waitForTransactionReceipt({
      hash: txResponse.hash as `0x${string}`,
    });

    return NextResponse.json({
      message: "NFT Minted successfully",
      transactionHash: txResponse.hash,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error },
      { status: 500 }
    );
  }
}