import { NextApiRequest, NextApiResponse } from "next";
import Safe, {
  PredictedSafeProps,
  SafeAccountConfig,
} from "@safe-global/protocol-kit";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { SIGNER_PRIVATE_KEY } = req.body;
    const RPC_URL = process.env.RPC_URL;

    if (!SIGNER_PRIVATE_KEY || !RPC_URL) {
      return res.status(400).json({ error: "Missing required input or environment variables" });
    }

    const account = privateKeyToAccount(SIGNER_PRIVATE_KEY);

    const safeAccountConfig: SafeAccountConfig = {
      owners: [account.address],
      threshold: 1,
    };

    const predictedSafe: PredictedSafeProps = {
      safeAccountConfig,
    };

    const protocolKit = await Safe.init({
      provider: RPC_URL,
      signer: SIGNER_PRIVATE_KEY,
      predictedSafe,
    });

    const safeAddress = await protocolKit.getAddress();

    const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction();

    const client = await protocolKit.getSafeProvider().getExternalSigner();
    if (!client) return res.status(500).json({ error: "Failed to get signer" });

    const customChain = defineChain({
      ...sepolia,
      name: "custom chain",
      transport: http(RPC_URL),
    });

    const transactionHash = await client.sendTransaction({
      to: deploymentTransaction.to as `0x${string}`,
      value: BigInt(deploymentTransaction.value),
      data: deploymentTransaction.data as `0x${string}`,
      chain: customChain,
    });

    const walletClient = createWalletClient({ transport: http(RPC_URL), chain: customChain });
    const publicClient = createPublicClient({ chain: customChain, transport: http() });

    const txReceipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });

    // Fund Safe
    await walletClient.sendTransaction({
      account: account,
      to: safeAddress as `0x${string}`,
      value: BigInt(0.1 * 1e18),
    });

    return res.status(200).json({
      message: "Safe deployed successfully",
      safeAddress,
      transactionHash,
      txReceipt,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error });
  }
}
