/* eslint-disable @typescript-eslint/no-unused-vars */
// app/api/execute-safe-tx/route.ts
import { NextRequest, NextResponse } from "next/server";
import Safe from "@safe-global/protocol-kit";
import {
    createPublicClient,
    createWalletClient,
    defineChain,
    encodeFunctionData,
    http,
    getContract,
} from "viem";
import { sepolia } from "viem/chains";
import { OperationType, MetaTransactionData } from "@safe-global/types-kit";
import {WETH_ABI} from "@/lib/abi";
import {
    INPUT_AMOUNT,
    COWSWAP_GPv2VAULT_RELAYER_ADDRESS,
    WETH_ADDRESS,
} from "@/lib/constants";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { SAFE_ADDRESS, SIGNER_PRIVATE_KEY } = body;
        const RPC_URL = process.env.RPC_URL;

        if (!SAFE_ADDRESS || !SIGNER_PRIVATE_KEY || !RPC_URL) {
            return NextResponse.json(
                { error: "Missing required input or environment variables" },
                { status: 400 }
            );
        }

        const customChain = defineChain({
            ...sepolia,
            name: "custom chain",
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

        const callDataDeposit = encodeFunctionData({
            abi: WETH_ABI,
            functionName: "deposit",
            args: [],
        });

        const safeDepositTx: MetaTransactionData = {
            to: WETH_ADDRESS,
            value: INPUT_AMOUNT,
            data: callDataDeposit,
            operation: OperationType.Call,
        };

        const wethInstance = getContract({
            address: WETH_ADDRESS,
            abi: WETH_ABI,
            client: publicClient,
        });

        const callDataApprove = encodeFunctionData({
            abi: WETH_ABI,
            functionName: "approve",
            args: [COWSWAP_GPv2VAULT_RELAYER_ADDRESS, INPUT_AMOUNT],
        });

        const safeApproveTx: MetaTransactionData = {
            to: WETH_ADDRESS,
            value: "0",
            data: callDataApprove,
            operation: OperationType.Call,
        };

        const safeTx = await protocolKit.createTransaction({
            transactions: [safeDepositTx, safeApproveTx],
            onlyCalls: true,
        });

        const txResponse = await protocolKit.executeTransaction(safeTx);
        await publicClient.waitForTransactionReceipt({
            hash: txResponse.hash as `0x${string}`,
        });

        return NextResponse.json({
            message: "Transaction executed successfully",
            transactionHash: txResponse.hash,
            wethBalance: await wethInstance.read.balanceOf([SAFE_ADDRESS]),
            ethBalance: await publicClient.getBalance({ 
                address: SAFE_ADDRESS as `0x${string}` 
            }),
        });
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error },
            { status: 500 }
        );
    }
}