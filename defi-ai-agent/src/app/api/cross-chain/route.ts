/* eslint-disable @typescript-eslint/no-explicit-any */
// /* eslint-disable @typescript-eslint/no-unused-vars */
// import { NextRequest, NextResponse } from "next/server";
// import axios from "axios";
// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();
//     const { srcChainId, destChainId, amount, receivingAccountAddress } = body;
//     if (!srcChainId || !destChainId || !amount || !receivingAccountAddress) {
//       return NextResponse.json(
//         { error: "Missing required input or environment variables" },
//         { status: 400 }
//       );
//     }

//     const res = await axios.post("http://localhost:8080/api/sendOFT", {
//       srcChainId,
//       destChainId,
//       amount,
//       receivingAccountAddress,
//     });
    
//     return NextResponse.json(res.data);
//   } catch (error) {
//     console.error("Error:", error);
//     return NextResponse.json(
//       { error: "Internal Server Error", details: error },
//       { status: 500 }
//     );
//   }
// }


// app/api/cross-chain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Options } from '@layerzerolabs/lz-v2-utilities';
import { waitForMessageReceived } from '@layerzerolabs/scan-client';
import { zeroPad } from '@ethersproject/bytes';
import { ethers } from 'ethers';
import { deploymentConfig } from '@/lib/deployment_config';
import { AdapterABI ,CustomTokenABI, OftABI} from '@/lib/abi';


if (!process.env.RPC_URL) {
    throw new Error('❌ Missing RPC_URL in environment variables.');
}

if (!process.env.DEPLOYER_ACCOUNT_PRIV_KEY) {
    throw new Error('❌ Missing DEPLOYER_ACCOUNT_PRIV_KEY in environment variables.');
}

const provider = new ethers.providers.JsonRpcProvider(process.env.SONIC_RPC_URL);
const signer = new ethers.Wallet(process.env.DEPLOYER_ACCOUNT_PRIV_KEY, provider);

const getContractInstance = (contractAddress: string, contractABI: any) => {
    console.log('✅ Contract Address:', contractAddress);
    return new ethers.Contract(contractAddress, contractABI, signer);
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'sendOFT') {
            return handleSendOFT(body);
        } else if (action === 'setPeer') {
            return handleSetPeer(body);
        }

        return NextResponse.json(
            { message: 'Invalid action' },
            { status: 400 }
        );
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { message: 'Internal Server Error', error: String(error) },
            { status: 500 }
        );
    }
}

async function handleSendOFT(body: any) {
    const { srcChainId, destChainId, amount, receivingAccountAddress } = body;

    if (!srcChainId || !destChainId || !amount || !receivingAccountAddress) {
        return NextResponse.json(
            {
                message: 'Bad Request',
                data: 'srcChainId, destChainId, amount, receivingAccountAddress are required',
            },
            { status: 400 }
        );
    }

    if (!(srcChainId in deploymentConfig) || !(destChainId in deploymentConfig)) {
        return NextResponse.json(
            {
                message: 'Invalid srcChainId or destChainId',
                data: 'Ensure both chain IDs are valid keys in deploymentConfig',
            },
            { status: 400 }
        );
    }

    const network = await provider.getNetwork();
    console.log('✅ Network:', network);
    const blockNumber = await provider.getBlockNumber();
    console.log('✅ Connected! Latest Block:', blockNumber);

    const oftAdapterContractAddress = deploymentConfig[srcChainId as keyof typeof deploymentConfig].adapterAddress;
    // const lzEndpointIdOnSrcChain = deploymentConfig[srcChainId as keyof typeof deploymentConfig].lzEndpointId;
    const lzEndpointIdOnDestChain = deploymentConfig[destChainId as keyof typeof deploymentConfig].lzEndpointId;
    const erc20TokenAddress = deploymentConfig[srcChainId as keyof typeof deploymentConfig].zeUSDAddress;

    const gasDropInWeiOnDestChain = process.env.gasDropInWeiOnDestChain;
    const executorLzReceiveOptionMaxGas = process.env.executorLzReceiveOptionMaxGas;
    const receiverAddressInBytes32 = zeroPad(receivingAccountAddress, 32);
    const adapterContractInstance = getContractInstance(oftAdapterContractAddress, AdapterABI);
    const customTokenContractInstance = getContractInstance(erc20TokenAddress, CustomTokenABI);
    const amountInWei = ethers.utils.parseEther(amount.toString());

    const approveTx = await customTokenContractInstance.approve(oftAdapterContractAddress, amountInWei);
    const approveTxReceipt = await approveTx.wait();
    console.log('sendOFT - approve tx:', approveTxReceipt?.hash);

    const options = Options.newOptions()
        .addExecutorNativeDropOption(BigInt(gasDropInWeiOnDestChain as string), receivingAccountAddress)
        .addExecutorLzReceiveOption(BigInt(executorLzReceiveOptionMaxGas as string), 0)
        .toHex()
        .toString();

    const sendParam = [
        lzEndpointIdOnDestChain,
        receiverAddressInBytes32,
        amountInWei,
        amountInWei,
        options,
        '0x',
        '0x',
    ];

    const [nativeFee] = await adapterContractInstance.quoteSend(sendParam, false);
    const sendTx = await adapterContractInstance.send(
        sendParam,
        [nativeFee, 0],
        receivingAccountAddress,
        {
            value: nativeFee,
        }
    );
    const sendTxReceipt = await sendTx.wait();

    const deliveredMsg = await waitForMessageReceived(Number(lzEndpointIdOnDestChain), sendTxReceipt?.hash);

    return NextResponse.json({
        message: 'Success',
        data: {
            receipt: sendTxReceipt,
            message: "sendOFT - received tx on destination chain",
            deliveredMsg
        },
    });
}

async function handleSetPeer(body: any) {
    const { srcChainId, destChainId } = body;

    if (!srcChainId || !destChainId) {
        return NextResponse.json(
            {
                message: 'Bad Request',
                data: 'srcChainId, destChainId are required',
            },
            { status: 400 }
        );
    }

    if (!(srcChainId in deploymentConfig) || !(destChainId in deploymentConfig)) {
        return NextResponse.json(
            {
                message: 'Invalid srcChainId or destChainId',
                data: 'Ensure both chain IDs are valid keys in deploymentConfig',
            },
            { status: 400 }
        );
    }

    const srcConfig = deploymentConfig[srcChainId as keyof typeof deploymentConfig];
    const destConfig = deploymentConfig[destChainId as keyof typeof deploymentConfig];

    if (!srcConfig.adapterAddress || !destConfig.lzEndpointId || !destConfig.oft_address) {
        return NextResponse.json(
            {
                message: 'Bad Request',
                data: 'Source Chain Required Data is Not Available in config file',
            },
            { status: 400 }
        );
    }

    const adapterContractInstance = getContractInstance(srcConfig.adapterAddress, AdapterABI);
    const isSourcPeerAlready = await adapterContractInstance.isPeer(
        destConfig.lzEndpointId,
        zeroPad(destConfig.oft_address, 32)
    );

    if (!isSourcPeerAlready) {
        const tx = await adapterContractInstance.setPeer(
            destConfig.lzEndpointId,
            zeroPad(destConfig.oft_address, 32)
        );
        await tx.wait();
    }

    const oftContractInstance = getContractInstance(destConfig.oft_address, OftABI);
    const isDestPeerAlready = await oftContractInstance.isPeer(
        destConfig.lzEndpointId,
        zeroPad(srcConfig.adapterAddress, 32)
    );

    if (!isDestPeerAlready) {
        const tx = await oftContractInstance.setPeer(
            destConfig.lzEndpointId,
            zeroPad(srcConfig.adapterAddress, 32)
        );
        await tx.wait();
    }

    return NextResponse.json({
        message: 'Success',
        data: 'Peers set successfully',
    });
}