/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { AINFT_ADDRESS } from "@/lib/constants";
import { AINFT_ABI } from "@/lib/abi";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const privateKey=process.env.WALLET_PRIVATE_KEY
    const { WALLET_ADDRESS, TOKEN_URI } = body;
    const RPC_URL = process.env.RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

    if (!privateKey || !WALLET_ADDRESS || !TOKEN_URI) {
      return NextResponse.json(
        { error: "Missing required input or environment variables" },
        { status: 400 }
      );
    }

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    const nftContract = new ethers.Contract(AINFT_ADDRESS, AINFT_ABI, wallet);
    const tx = await nftContract.mintNft(WALLET_ADDRESS, TOKEN_URI);
    await tx.wait();

    return NextResponse.json({
      message: "NFT Minted successfully",
      transactionHash: tx.hash,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error },
      { status: 500 }
    );
  }
}