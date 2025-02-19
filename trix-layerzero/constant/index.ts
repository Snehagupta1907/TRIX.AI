import ADAPTER_ABI from '../artifacts/contracts/implementations/LZAdapter.sol/LZ_Adapter.json'
import CUSTOMTOKENABI from '../artifacts/contracts/implementations/CustomToken.sol/CustomToken.json'
import OFTABI from '../artifacts/contracts/implementations/CustomToken_OFT.sol/CustomToken_OFT.json'
const AdapterABI = ADAPTER_ABI.abi
const CustomTokenABI = CUSTOMTOKENABI.abi
const OftABI = OFTABI.abi

export { AdapterABI, CustomTokenABI, OftABI }