import { ethers } from 'hardhat'
import { defaultAbiCoder } from '@ethersproject/abi'
const endpointAbi = [
    'function setConfig(address oappAddress, address sendLibAddress, tuple(uint32 eid, uint32 configType, bytes config)[] setConfigParams) external',
]
const YOUR_OAPP_ADDRESS = '0xBFff78BB02925E4D8671D0d90B2a6330fcAedd87'
const YOUR_SEND_LIB_ADDRESS = '0xd682ECF100f6F4284138AA925348633B0611Ae21'
const YOUR_ENDPOINT_CONTRACT_ADDRESS = '0x6C7Ab2202C98C4227C5c46f1417D81144DA716Ff'
const YOUR_RECEIVE_LIB_ADDRESS = '0xcF1B0F4106B0324F96fEfcC31bA9498caa80701C'
const remoteEid = 40349

const ulnConfig = {
    confirmations: 99, // Example value, replace with actual
    requiredDVNCount: 1, // Example value, replace with actual
    optionalDVNCount: 0, // Example value, replace with actual
    optionalDVNThreshold: 0, // Example value, replace with actual
    requiredDVNs: ['0x88b27057a9e00c5f05dda29241027aff63f9e6e0'], // Replace with actual addresses
    optionalDVNs: [], // Replace with actual addresses
}

const executorConfig = {
    maxMessageSize: 10000, // Example value, replace with actual
    executorAddress: '0xcfa038455b54714821f291814071161c9870B891', // Replace with the actual executor address
}

async function main() {
    console.log('Setting config for endpoint contract:', YOUR_ENDPOINT_CONTRACT_ADDRESS)

    const sendingAccountPrivKey = process.env.DEPLOYER_ACCOUNT_PRIV_KEY
    if (!sendingAccountPrivKey) {
        throw new Error('Missing DEPLOYER_ACCOUNT_PRIV_KEY')
    }
    const sender = new ethers.Wallet(sendingAccountPrivKey, ethers.provider)

    const endpointContract = new ethers.Contract(YOUR_ENDPOINT_CONTRACT_ADDRESS, endpointAbi, sender)
    console.log('Endpoint contract:', endpointContract)

    const configTypeUlnStruct =
        'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'
    const encodedUlnConfig = defaultAbiCoder.encode([configTypeUlnStruct], [ulnConfig])

    const configTypeExecutorStruct = 'tuple(uint32 maxMessageSize, address executorAddress)'
    const encodedExecutorConfig = defaultAbiCoder.encode([configTypeExecutorStruct], [executorConfig])

    // Define the SetConfigParam structs
    const setConfigParamUln = {
        eid: remoteEid,
        configType: 2, // ULN_CONFIG_TYPE
        config: encodedUlnConfig,
    }

    const setConfigParamExecutor = {
        eid: remoteEid,
        configType: 1, // EXECUTOR_CONFIG_TYPE
        config: encodedExecutorConfig,
    }

    console.log('setConfigParamExecutor', setConfigParamExecutor, 'setConfigParamUln', setConfigParamUln)

    try {
        const tx = await endpointContract.setConfig(
            YOUR_OAPP_ADDRESS,
            YOUR_SEND_LIB_ADDRESS,
            [setConfigParamUln, setConfigParamExecutor] // Array of SetConfigParam structs
        )

        const receipt = await tx.wait()
        console.log('Transaction confirmed:', receipt.hash)
    } catch (error) {
        console.error('Transaction failed:', error)
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
