import chain , {expect} from 'chai';
import hre from 'hardhat'
import { Contract,utils, ethers, Wallet, BigNumber } from 'ethers'
import { ecsign } from 'ethereumjs-util'
import { expandTo18Decimals, getApprovalDigest } from './shared/utilities'
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { sign } from 'crypto';



// chai.use(solidity);

const TOTAL_SUPPLY = expandTo18Decimals(10000);
const TEST_AMOUNT = expandTo18Decimals(10);


describe('UniswapV2ERC20' , ()=>{
      let token : Contract;
      let signer : SignerWithAddress;
      let user : SignerWithAddress;
      let signerWallet : Wallet;

      let cid :number=  hre.network.config.chainId!
      beforeEach(async() => {
        [signer,user,]= await hre.ethers.getSigners();
        signerWallet = new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
        let token_factory = await hre.ethers.getContractFactory('ERC20');
        token = await token_factory.deploy(TOTAL_SUPPLY);
        await token.deployed();
        //   token = await deployContract(wallet,ERC20, [TOTAL_SUPPLY])
      })


      it ('name, symbol , totalSupply , balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async() => {
          const name = await token.name();
          expect(name).to.eq('Uniswap V2');
          expect(await token.symbol()).to.eq('UNI-V2');
          expect(await token.decimals()).to.eq(18);
          expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY);
          expect(await token.balanceOf(signer.address)).to.eq(TOTAL_SUPPLY);
          
         
          expect(await token.DOMAIN_SEPARATOR()).to.eq(utils.keccak256(
            utils.defaultAbiCoder.encode(
                ['bytes32', 'bytes32','bytes32','uint256','address'],
                [
                    keccak256(
                        toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
                    ),
                    keccak256(toUtf8Bytes(name)),
                    keccak256(toUtf8Bytes('1')),
                    cid,
                    token.address
                ]
            )
          ))

          expect(await token.PERMIT_TYPEHASH()).to.eq(
              utils.defaultAbiCoder.encode(
                  ['bytes32'],
                  [utils.keccak256(
                      toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
                  )]
              )
          )
      })

    it('approve' , async()=> {
        await expect(token.approve(user.address,TEST_AMOUNT)).
        to.emit(token,'Approval').
        withArgs(signer.address,user.address,TEST_AMOUNT);
        expect( await token.allowance(signer.address,user.address)).to.eq(TEST_AMOUNT);
        
    })
    
    it('transfer', async() => {
        await expect(token.transfer(user.address,TEST_AMOUNT)).
        to.emit(token,'Transfer').
        withArgs(signer.address,user.address,TEST_AMOUNT)

        expect(await token.balanceOf(user.address)).to.eq(TEST_AMOUNT);
        expect(await token.balanceOf(signer.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT));
    })

    it('transfer:fail', async () => {
        await expect(token.transfer(signer.address, TOTAL_SUPPLY.add(1))).to.be.reverted // ds-math-sub-underflow
        await expect(token.connect(user).transfer(signer.address, 1)).to.be.reverted // ds-math-sub-underflow
      })

    it('transferFrom',async()=>{
        await token.approve(user.address, TEST_AMOUNT);
        await expect(token.connect(user).transferFrom(signer.address,user.address,TEST_AMOUNT))
            .to.emit(token, 'Transfer')
            .withArgs(signer.address, user.address, TEST_AMOUNT);
        expect(await token.allowance(signer.address,user.address)).to.eq(0);
        expect(await token.balanceOf(signer.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
        expect(await token.balanceOf(user.address)).to.eq(TEST_AMOUNT)
        
    })

    it('transferFrom:max', async () => {
        await token.approve(user.address, ethers.constants.MaxUint256)
        await expect(token.connect(user).transferFrom(signer.address, user.address, TEST_AMOUNT))
          .to.emit(token, 'Transfer')
          .withArgs(signer.address, user.address, TEST_AMOUNT)
        expect(await token.allowance(signer.address, user.address)).to.eq( ethers.constants.MaxUint256)
        expect(await token.balanceOf(signer.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
        expect(await token.balanceOf(user.address)).to.eq(TEST_AMOUNT)
      })

      it('permit', async()=>{
          const nonce = await token.nonces(signer.address)
          const deadline = ethers.constants.MaxUint256
          const digest = await getApprovalDigest(
              token,
              {owner: signer.address , spender:user.address , value:TEST_AMOUNT },
              nonce,
              deadline,
              cid
          )

          const { v,r,s} = ecsign(Buffer.from(digest.slice(2),'hex') ,Buffer.from(signerWallet.privateKey.slice(2),'hex'))
          await expect(token.permit(signer.address, user.address, TEST_AMOUNT, deadline, v, utils.hexlify(r), utils.hexlify(s)))
          .to.emit(token, 'Approval')
          .withArgs(signer.address, user.address, TEST_AMOUNT)
         expect(await token.allowance(signer.address, user.address)).to.eq(TEST_AMOUNT)
         expect(await token.nonces(signer.address)).to.eq(BigNumber.from(1))
      })
})

