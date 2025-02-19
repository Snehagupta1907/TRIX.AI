/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { AINFT_ADDRESS } from "@/lib/constants";
import { AINFT_ABI } from "@/lib/abi";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    const { WALLET_ADDRESS, TOKEN_URI } = body;
    if (!privateKey || !AINFT_ADDRESS || !WALLET_ADDRESS || !TOKEN_URI) {
      return NextResponse.json(
        { error: "Missing required input or environment variables" },
        { status: 400 }
      );
    }
    const RPC_URL =
      "https://endpoints.omniatech.io/v1/mantle/sepolia/public";
    const provider = new ethers.providers.JsonRpcProvider({
      url: RPC_URL,
      skipFetchSetup: true,
    });
    const wallet = new ethers.Wallet(privateKey, provider);
    const signer = await wallet.connect(provider);

    const nftContract = new ethers.Contract(AINFT_ADDRESS, AINFT_ABI, signer);

    const tx = await nftContract.mintNFT(WALLET_ADDRESS, TOKEN_URI);
    await tx.wait();

    console.log("Transaction Hash:", tx);
    return NextResponse.json({
      data: `https://explorer.sepolia.mantle.xyz/tx/${tx.hash}`,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
