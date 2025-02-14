/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { AINFT_ADDRESS } from "@/lib/constants";
import { AINFT_ABI } from "@/lib/abi";
import { arbitrumSepolia } from "viem/chains";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const privateKey = process.env.WALLET_PRIVATE_KEY;  
    const { WALLET_ADDRESS, TOKEN_URI } = body;
    const network = {
      name: 'arbitrum-sepolia',
      chainId: 421614, 
    };
    if (!privateKey || !AINFT_ADDRESS || !WALLET_ADDRESS || !TOKEN_URI) {
      return NextResponse.json(
        { error: "Missing required input or environment variables" },
        { status: 400 }
      );
    }
    const RPC_URL = "https://arbitrum-sepolia.infura.io/v3/475d3eae8c6d45899d272b36c7cc0c09";
    const provider = new ethers.providers.JsonRpcProvider({ url: RPC_URL, skipFetchSetup: true });
    const wallet =  new ethers.Wallet(privateKey,provider);
    const signer = await wallet.connect(provider);

    console.log('Waiting for network', provider)

    const nftContract =  new ethers.Contract(AINFT_ADDRESS, AINFT_ABI, signer);

    const tx = await nftContract.mintNFT(WALLET_ADDRESS, TOKEN_URI);
    await tx.wait();

    console.log('Transaction Hash:',tx);
    return NextResponse.json({
      message: "NFT Minted successfully",
      transactionHash: tx.hash,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
