/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextApiRequest, NextApiResponse } from "next";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  encodeFunctionData,
  getContract,
} from "viem";
import { OperationType, MetaTransactionData } from "@safe-global/types-kit";
import Safe from "@safe-global/protocol-kit";
import { arbitrumSepolia } from "viem/chains";

import { AINFT_ADDRESS } from "@/lib/constants";
import AINFT_ABI from "@/lib/abi";
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  console.log("Request Body:", req.body);
  try {
    const { SAFE_ADDRESS, SIGNER_PRIVATE_KEY } = req.body;
    const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";

    if (!SAFE_ADDRESS || !SIGNER_PRIVATE_KEY || !RPC_URL) {
      return res
        .status(400)
        .json({ error: "Missing required input or environment variables" });
    }
    const customChain = defineChain({
      ...arbitrumSepolia,
      name: "Arbitrum Sepolia",
      transport: http(RPC_URL),
    });
    const publicClient = createPublicClient({
      transport: http(RPC_URL!),
      chain: customChain,
    });
    const walletClient = createWalletClient({
      transport: http(RPC_URL!),
      chain: customChain,
    });

    const protocolKit = await Safe.init({
      provider: RPC_URL,
      signer: SIGNER_PRIVATE_KEY,
      safeAddress: SAFE_ADDRESS,
    });

    const isSafeDeployed = await protocolKit.isSafeDeployed();
    if (!isSafeDeployed) {
      return res.status(400).json({ error: "Safe not deployed" });
    }

    const callDataDeposit = encodeFunctionData({
      abi: AINFT_ABI,
      functionName: "mintNft",
      args: [WALLET_ADDRESS, TOKEN_URI],
    });

    const safeMintTx: MetaTransactionData = {
      to: AINFT_ADDRESS,
      value: "0",
      data: callDataDeposit,
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
    return res.status(200).json({
      message: "NFT Minted successfully",
      txhash: txResponse.hash,
      res: txResponse,
    });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error });
  }
}
