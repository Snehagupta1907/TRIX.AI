/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextApiRequest, NextApiResponse } from "next";
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
import WETH_ABI from "@/lib/abi";
import {
    INPUT_AMOUNT, COWSWAP_GPv2VAULT_RELAYER_ADDRESS,
    WETH_ADDRESS
} from "@/lib/constants";




export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const { SAFE_ADDRESS, SIGNER_PRIVATE_KEY } = req.body;
        const RPC_URL = process.env.RPC_URL;

        if (!SAFE_ADDRESS || !SIGNER_PRIVATE_KEY || !RPC_URL) {
            return res.status(400).json({ error: "Missing required input or environment variables" });
        }

        const customChain = defineChain({
            ...sepolia,
            name: "custom chain",
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

        return res.status(200).json({
            message: "Transaction executed successfully",
            transactionHash: txResponse.hash,
            wethBalance: await wethInstance.read.balanceOf([SAFE_ADDRESS]),
            ethBalance: await publicClient.getBalance({ address: SAFE_ADDRESS as `0x${string}` }),
        });
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error });
    }
}
