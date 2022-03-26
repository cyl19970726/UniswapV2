import hre from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai, { expect } from 'chai'
import { Contract,BigNumber, Wallet, ethers } from 'ethers'
import { expandTo18Decimals } from './shared/utilities'


const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

// chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('UniswapV2Pair' , () => {
    
    let signer:SignerWithAddress;
    let user: SignerWithAddress;
    let signerWallet:Wallet;

    let pair:Contract;
    let token0:Contract;
    let token1:Contract;
    let PairFactory:Contract

    const overrides = {
        gasLimit: 9999999
      }

    beforeEach(async()=>{
        [signer,user,] =await hre.ethers.getSigners();

        let pairfactory_factory = await hre.ethers.getContractFactory("UniswapV2Factory");
        PairFactory = await pairfactory_factory.deploy(signer.address);
        await PairFactory.deployed();

        // let pair_factory = await hre.ethers.getContractFactory("UniswapV2Pair") ;
        
        // await Pair.deployed();

        let token_factory = await hre.ethers.getContractFactory('ERC20');
        let TokenA = await token_factory.deploy(expandTo18Decimals(10000),overrides);
        await TokenA.deployed();
        let TokenB = await token_factory.deploy(expandTo18Decimals(10000),overrides);
        await TokenB.deployed();

        await PairFactory.createPair(TokenA.address,TokenB.address,overrides);
        const pairAddress = await PairFactory.getPair(TokenA.address, TokenB.address)

        pair = await hre.ethers.getContractAt("UniswapV2Pair",pairAddress);

        const token0Address = (await pair.token0()).address
        token0 = TokenA.address === token0Address ? TokenA : TokenB
        token1 = TokenA.address === token0Address ? TokenB : TokenA
    })

    it('mint', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)
        await token0.transfer(pair.address, token0Amount)
        await token1.transfer(pair.address, token1Amount)
    
        const expectedLiquidity = expandTo18Decimals(2)
        await expect(pair.mint(signer.address, overrides))
          .to.emit(pair, 'Transfer')
          .withArgs(ethers.constants.AddressZero, ethers.constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pair, 'Transfer')
          .withArgs(ethers.constants.AddressZero, signer.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pair, 'Sync')
          .withArgs(token0Amount, token1Amount)
          .to.emit(pair, 'Mint')
          .withArgs(signer.address, token0Amount, token1Amount)
    
        expect(await pair.totalSupply()).to.eq(expectedLiquidity)
        expect(await pair.balanceOf(signer.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        expect(await token0.balanceOf(pair.address)).to.eq(token0Amount)
        expect(await token1.balanceOf(pair.address)).to.eq(token1Amount)
        const reserves = await pair.getReserves()
        expect(reserves[0]).to.eq(token0Amount)
        expect(reserves[1]).to.eq(token1Amount)
      })
    

})