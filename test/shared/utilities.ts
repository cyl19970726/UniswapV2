import {
    Contract,
    BigNumber,
    utils
} from 'ethers';
// import { Web3Provider } from 'ethers/providers'
// import {
// //   BigNumber,
//   bigNumberify,
//   getAddress,
//   keccak256,
//   defaultAbiCoder,
//   toUtf8Bytes,
//   solidityPack
// } from 'utils'


const PERMIT_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

export function expandTo18Decimals(n: number): BigNumber {
    
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
  }
  
function getDomainSeparator(name: string, tokenAddress: string, chainId : number) {
    return utils.keccak256(
        utils.defaultAbiCoder.encode(
        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
        [
            utils.keccak256(utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
            utils.keccak256(utils.toUtf8Bytes(name)),
            utils.keccak256(utils.toUtf8Bytes('1')),
            chainId,
          tokenAddress
        ]
      )
    )
}

// export function getCreate2Address(
//     factoryAddress:string,
//     [tokenA , tokenB] :[string,string],
//     bytecode : string 
// ): string {
//     const [token0 , token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB , tokenA]
//     const create2Inputs = [
//         '0xff',
//         factoryAddress,
//         keccak256(solidityPack(['address','address'],[token0,token1]))
//     ]
// }

export async function getApprovalDigest(
    token:Contract,
    approve:{
        owner:string 
        spender:string 
        value:BigNumber
    },
    nonce: BigNumber,
    deadline: BigNumber,
    chainId:number
):Promise<string> {
    const name = await token.name();
    const DOMAIN_SPEARATOR = getDomainSeparator(name,token.address,chainId)
    return utils.keccak256(
        utils.solidityPack(
            ['bytes1','bytes1','bytes32','bytes32'],
            [
                '0x19',
                '0x01',
                DOMAIN_SPEARATOR,
                utils.keccak256(
                    utils.defaultAbiCoder.encode(
                        ['bytes32','address','address','uint256','uint256','uint256'],
                        [PERMIT_TYPEHASH,approve.owner,approve.spender,approve.value,nonce,deadline]
                    )
                )
            ]
        )
    )
}