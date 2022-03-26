import hre from "hardhat";
import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expandTo18Decimals } from './utilities'

interface FactoryFixture {
    factory: Contract
  }


const overrides = {
    gasLimit: 9999999
  }
  

export async function factoryFixture(signer:SignerWithAddress): Promise<FactoryFixture> {
    const factory_factory = await hre.ethers.getContractFactory("UniswapV2Factory");
    const factory = await factory_factory.deploy(signer,overrides);
    await factory.deployed();
    return { factory }
}
  
interface PairFixture extends FactoryFixture {
    factory:Contract
    token0: Contract
    token1: Contract
    pair: Contract
}

export async function pairFixture( signer:SignerWithAddress): Promise<PairFixture> {
    const {factory} = await factoryFixture(signer);

    let token_factory = await hre.ethers.getContractFactory('ERC20');
    let TokenA:Contract = await token_factory.deploy(expandTo18Decimals(10000),overrides);
    await TokenA.deployed();
    let TokenB:Contract = await token_factory.deploy(expandTo18Decimals(10000),overrides);
    await TokenB.deployed();

    await factory.createPair(TokenA.address,TokenB.address,overrides);
    const pairAddress = await factory.getPair(TokenA.address, TokenB.address);
    const pair:Contract = await hre.ethers.getContractAt("UniswapV2Pair",pairAddress);

    const token0Address = (await pair.token0()).address
    const token0 = TokenA.address === token0Address ? TokenA : TokenB
    const token1 = TokenA.address === token0Address ? TokenB : TokenA

    return { factory, token0, token1, pair, }
}
  