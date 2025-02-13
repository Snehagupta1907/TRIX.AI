import { NextApiRequest, NextApiResponse } from "next";
import Safe from "@safe-global/protocol-kit";
import {
  createPublicClient,
  defineChain,
  http,
} from "viem";
import { sepolia } from "viem/chains";
import { OperationType, MetaTransactionData } from "@safe-global/types-kit";
import {
  SwapAdvancedSettings,
  TradeParameters,
  TradingSdk,
  SupportedChainId,
  OrderKind,
  SigningScheme,
} from "@cowprotocol/cow-sdk";
import { VoidSigner } from "@ethersproject/abstract-signer";
import { JsonRpcProvider } from "@ethersproject/providers";
// import {
//     INPUT_AMOUNT, } from "@/lib/constants";
// COW_ADDRESS, WETH_ADDRESS,
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { SAFE_ADDRESS, SIGNER_PRIVATE_KEY,buyAddress,sellAddress,inputAmt } = req.body;
    const RPC_URL = process.env.RPC_URL;

    if (!SAFE_ADDRESS || !SIGNER_PRIVATE_KEY || !RPC_URL) {
      return res.status(400).json({ error: "Missing required input or environment variables" });
    }

    const protocolKit = await Safe.init({
      provider: RPC_URL,
      signer: SIGNER_PRIVATE_KEY,
      safeAddress: SAFE_ADDRESS,
    });

    const smartContractWalletAddress = SAFE_ADDRESS;
    const traderParams = {
      chainId: SupportedChainId.SEPOLIA,
      signer: new VoidSigner(
        smartContractWalletAddress,
        new JsonRpcProvider(RPC_URL)
      ),
      appCode: "awesome-app",
    };

    const sdk = new TradingSdk(traderParams, { enableLogging: false });
    const parameters: TradeParameters = {
      kind: OrderKind.SELL,
      sellToken: sellAddress,
      sellTokenDecimals: 18,
      buyToken: buyAddress,
      buyTokenDecimals: 18,
      amount: inputAmt,
    };

    const advancedParameters: SwapAdvancedSettings = {
      quoteRequest: {
        signingScheme: SigningScheme.PRESIGN,
      },
    };

    const orderId = await sdk.postSwapOrder(parameters, advancedParameters);
    console.log(`Order ID: [${orderId}]`);

    const preSignTransaction = await sdk.getPreSignTransaction({
      orderId,
      account: smartContractWalletAddress,
    });

    const customChain = defineChain({
      ...sepolia,
      name: "custom chain",
      transport: http(RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: customChain,
      transport: http(RPC_URL),
    });

    const safePreSignTx: MetaTransactionData = {
      to: preSignTransaction.to,
      value: preSignTransaction.value,
      data: preSignTransaction.data,
      operation: OperationType.Call,
    };

    const safeTx = await protocolKit.createTransaction({
      transactions: [safePreSignTx],
      onlyCalls: true,
    });

    const txResponse = await protocolKit.executeTransaction(safeTx);
    console.log(`Sent tx hash: [${txResponse.hash}]`);
    await publicClient.waitForTransactionReceipt({
      hash: txResponse.hash as `0x${string}`,
    });

    return res.status(200).json({
      message: "Transaction executed successfully",
      transactionHash: txResponse.hash,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error });
  }
}
