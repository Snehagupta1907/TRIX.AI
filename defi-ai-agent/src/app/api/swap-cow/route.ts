// app/api/execute-cow-trade/route.ts
import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      SAFE_ADDRESS, 
      SIGNER_PRIVATE_KEY, 
      buyAddress, 
      sellAddress, 
      inputAmt 
    } = body;
    const RPC_URL = process.env.RPC_URL;

    if (!SAFE_ADDRESS || !SIGNER_PRIVATE_KEY || !RPC_URL) {
      return NextResponse.json(
        { error: "Missing required input or environment variables" },
        { status: 400 }
      );
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

    return NextResponse.json({
      message: "Transaction executed successfully",
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