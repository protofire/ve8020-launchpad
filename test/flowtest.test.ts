import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
  utils,
  constants,
  ContractReceipt,
} from "ethers";

import {
  RewardDistributor,
  Launchpad,
  VotingEscrow,
  TestToken,
  BPTToken,
  SmartWalletWhitelist,
  SmartCheckerAllowAll,
  LensReward,
} from "../typechain-types";

let owner: Signer;
let creator: Signer;
let user1: Signer;
let user2: Signer;
let user3: Signer;

let ownerAddress: string;
let creatorAddress: string;
let user1Address: string;
let user2Address: string;
let user3Address: string;

let user1Amount: BigNumber;
let user2Amount: BigNumber;
let totalRewardAmount: BigNumber;


let erc20Factory: ContractFactory;
let rewardToken: TestToken;

let bptFactory: ContractFactory;
let bptToken: BPTToken;

let rdFactory: ContractFactory;
let rewardDistributorImpl: RewardDistributor;
let veFactory: ContractFactory;
let votingEscrowImpl: VotingEscrow;
let launchpadFactory: ContractFactory;
let launchpad: Launchpad;

let lens: LensReward;

let smartWalletChecker: SmartWalletWhitelist;
let smartCheckerAllower: SmartCheckerAllowAll;

let day: number = 60 * 60 * 24;
let week: number = 60 * 60 * 24 * 7;


describe("Launchpad flow test", function () {

  before(async () => {
    [owner, creator, user1, user2, user3] = await ethers.getSigners();
    [ownerAddress, creatorAddress, user1Address, user2Address, user3Address] = await Promise.all([
      owner.getAddress(),
      creator.getAddress(),
      user1.getAddress(),
      user2.getAddress(),
      user3.getAddress(),
    ]);

    erc20Factory = await ethers.getContractFactory('TestToken');
    rewardToken = (await erc20Factory.deploy()) as TestToken;

    bptFactory = await ethers.getContractFactory('BPTToken');
    bptToken = (await bptFactory.deploy()) as BPTToken;

    veFactory = await ethers.getContractFactory('VotingEscrow');
    votingEscrowImpl = (await veFactory.deploy()) as VotingEscrow;

    rdFactory = await ethers.getContractFactory('RewardDistributor');
    rewardDistributorImpl = (await rdFactory.deploy()) as RewardDistributor;

    const smartCheckerFactory = await ethers.getContractFactory('SmartWalletWhitelist');
    smartWalletChecker = (await smartCheckerFactory.deploy(creatorAddress)) as SmartWalletWhitelist;

    const smartCheckerAllowerFactory = await ethers.getContractFactory('SmartCheckerAllowAll');
    smartCheckerAllower = (await smartCheckerAllowerFactory.deploy()) as SmartCheckerAllowAll;

    const lensFactory = await ethers.getContractFactory('LensReward');
    lens = (await lensFactory.deploy()) as LensReward;

    totalRewardAmount = utils.parseEther("10000")
    await rewardToken.mint(creatorAddress, totalRewardAmount);
    
    user1Amount = utils.parseEther('2000');
    user2Amount = utils.parseEther('1000');
    await bptToken.mint(user1Address, user1Amount);
    await bptToken.mint(user2Address, user2Amount);
  });

  describe('Initial states', function() {
    it('Should mint initial token balances', async () => {

      expect(await rewardToken.balanceOf(creatorAddress)).to.equal(totalRewardAmount);
      expect(await bptToken.balanceOf(user1Address)).to.equal(user1Amount);
      expect(await bptToken.balanceOf(user2Address)).to.equal(user2Amount);
    });

    it('Should deploy empty VE implementation', async () => {
      const name = await votingEscrowImpl.name();
      const symbol = await votingEscrowImpl.symbol();
      const decimals = await votingEscrowImpl.decimals();
      const someValue = await votingEscrowImpl.get_last_user_slope(user1Address);
      const isInitialized = await votingEscrowImpl.is_initialized();
      expect(name).to.equal('');
      expect(symbol).to.equal('');
      expect(decimals).to.equal(0);
      expect(someValue).to.equal(0);
      expect(isInitialized).to.equal(false);
    });

    it('Should deploy empty RewardDistributor implementation', async () => {
      const ve = await rewardDistributorImpl.getVotingEscrow();
      const timeCursor = await rewardDistributorImpl.getTimeCursor();    
      const isInitialized = await rewardDistributorImpl.isInitialized();
      expect(ve).to.equal(constants.AddressZero);
      expect(timeCursor).to.equal(0);
      expect(isInitialized).to.equal(false);
    });

  });

  describe('With initialized implementations', function () {
    before(async() => {
      let maxLockTime: number = 60 * 60 * 24 * 7; // week
      await votingEscrowImpl.initialize(
        bptToken.address,
        'initName',
        'initSymbol',
        user2Address,
        maxLockTime
      );

      const startTime = (await time.latest()) + 99999999999;
      await rewardDistributorImpl.initialize(
        votingEscrowImpl.address,
        startTime,
        user2Address
      );
    });

    it('Should return values of VE implementation', async () => {
      expect(await votingEscrowImpl.name()).to.equal('initName');
    });

    it('Should return values of RD implementation', async () => {
      expect(await rewardDistributorImpl.getVotingEscrow())
        .to.equal(votingEscrowImpl.address);
    });
  });


  describe('Deploy Launchpad', function () {
    before(async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');
      launchpad = (await launchpadFactory.deploy(
        votingEscrowImpl.address,
        rewardDistributorImpl.address
        )) as Launchpad;
    });

    it('Should set admin of launchpad', async () => {
      expect(await launchpad.admin()).to.equal(ownerAddress);
    });
    
    it('Should set correct VE implementation of launchpad', async () => {
      expect(await launchpad.votingEscrow())
        .to.equal(votingEscrowImpl.address);
    });

    it('Should set correct RD implementation of launchpad', async () => {
      expect(await launchpad.rewardDistributor())
        .to.equal(rewardDistributorImpl.address);
    });
  });


  describe('Deploy VE system', function () {
    let veName = 'Lock system 1';
    let veSymbol = 'LS_1';
    let txResult: ContractTransaction;
    let txReceipt: ContractReceipt;

    let votingEscrow: VotingEscrow;
    let rewardDistributor: RewardDistributor;

    let rewardStartTime: number;
    let maxLockTime: number = 60 * 60 * 24 * 30; // 30 days

    before(async () => {
      rewardStartTime = (await time.latest()) + week;
      txResult = await launchpad.connect(creator).deploy(
        bptToken.address,
        veName,
        veSymbol,
        maxLockTime,
        rewardStartTime
      );
      txReceipt = await txResult.wait();
    });

    it('Should emit event on deployment', async () => {
      // @ts-ignore
      const event = txReceipt.events[0];
      // @ts-ignore
      expect(event.args.token).to.equal(bptToken.address);
      // @ts-ignore
      expect(event.args.admin).to.equal(creatorAddress);
      // @ts-ignore
      expect(event.args.votingEscrow)
        .to.not.equal(constants.AddressZero);
      // @ts-ignore
      expect(event.args.rewardDistributor)
        .to.not.equal(constants.AddressZero);
    });

    describe('Deployed system test', function () {
      before(async() => {
        // @ts-ignore
        const votingEscrowAdr = txReceipt.events[0].args.votingEscrow;
        // @ts-ignore
        const rewardDistributorAdr = txReceipt.events[0].args.rewardDistributor;

        votingEscrow = await ethers.getContractAt(
          'VotingEscrow',
          votingEscrowAdr
        );
        rewardDistributor = await ethers.getContractAt(
          'RewardDistributor',
          rewardDistributorAdr
        );
      })

      it('Should return correct initial states for VotingEscrow', async () => {
        expect(await votingEscrow.name()).to.equal(veName);
        expect(await votingEscrow.symbol()).to.equal(veSymbol);

        expect(await votingEscrow.decimals())
          .to.equal(await bptToken.decimals());

        expect(await votingEscrow.token())
          .to.equal(bptToken.address);
      });

      it('Should return non-zero initial point_history', async () => {
        const firstPH = await votingEscrow.point_history(0);
        expect(firstPH.blk).to.be.gt(3);
        expect(firstPH.ts).to.be.gt(1000);
      });

      it('Should return correct admin of the VotingEscrow', async () => {
        expect(await votingEscrow.admin()).to.equal(creatorAddress);
      });

      it('Should return correct MAXTIME of the lock of the VotingEscrow', async () => {
        expect(await votingEscrow.MAXTIME()).to.equal(maxLockTime);
      });

      it(`Shouldn't allow to initialize VotingEscrow again`, async () => {
        await expect(votingEscrow.initialize(
          bptToken.address,
          'newNameFail',
          'newSymbolFail',
          creatorAddress,
          maxLockTime
        ))
          .to.be.revertedWith('only once');
      });

      it('Should return correct of the VotingEscrow for the rewardDistributor', async () => {
        expect(await rewardDistributor.getVotingEscrow())
          .to.equal(votingEscrow.address);
      });

      it('Should return non-zero timeCursor of the VotingEscrow', async () => {
        expect(await rewardDistributor.getTimeCursor())
          .to.be.gt(await time.latest());
      });

      describe('Users make deposit', function () {
        let createLockTime: number;

        before(async() => {
          // approvals before deposit
          await bptToken.connect(user1).approve(votingEscrow.address, constants.MaxUint256);
          await bptToken.connect(user2).approve(votingEscrow.address, constants.MaxUint256);

          // lock-deposit
          createLockTime = await time.latest();
          await votingEscrow.connect(user1).create_lock(user1Amount, createLockTime + week * 2);
          await votingEscrow.connect(user2).create_lock(user2Amount, createLockTime + week * 2);
        });

        it('Should return zero balance after deposit', async () => {
          expect(await bptToken.balanceOf(user1Address)).to.equal(constants.Zero);
          expect(await bptToken.balanceOf(user2Address)).to.equal(constants.Zero);
        });

        it('Should increase votingEscrow balance', async () => {
          expect(await bptToken.balanceOf(votingEscrow.address))
            .to.equal(user1Amount.add(user2Amount));
        })

        it('Should return balance in Voting escrow', async () => {
          console.log('balance0:', await votingEscrow.connect(user1)["balanceOf(address,uint256)"](user1Address, createLockTime));

          // await time.increase(week);          
          console.log('balance1s:', await votingEscrow.connect(user1)["balanceOf(address,uint256)"](user1Address, createLockTime+1));
          console.log('balance1d:', await votingEscrow.connect(user1)["balanceOf(address,uint256)"](user1Address, createLockTime + day));


          console.log('balance1:', await votingEscrow.connect(user1)["balanceOf(address,uint256)"](user1Address, createLockTime+week));
          console.log('balance2:', await votingEscrow.connect(user1)["balanceOf(address,uint256)"](user1Address, createLockTime+2*week-3.8*day));
          console.log('balance2:', await votingEscrow.connect(user1)["balanceOf(address,uint256)"](user1Address, createLockTime+2*week-4.0*day));

        })
      });

      describe('Adding reward tokens', function () {
        let startRewardTime: number;

        before(async() => {
          const depositAmount = utils.parseEther('10000');

          await rewardToken.connect(creator)
            .approve(rewardDistributor.address, depositAmount);

          await rewardDistributor.connect(creator)
            .addAllowedRewardTokens([rewardToken.address]);
          
          startRewardTime = (await rewardDistributor.getTimeCursor()).toNumber();
          await time.increaseTo(startRewardTime);

          await rewardDistributor.connect(creator)
            .depositToken(rewardToken.address, totalRewardAmount);
        });

        it('Should be able to deposit rewards into rewardDistributor', async () => {

          expect(await rewardToken.balanceOf(rewardDistributor.address))
            .to.equal(totalRewardAmount);
        })

        describe('Claim rewards', function () {
          it('Should calculate rewards', async () => {
            let rewards = await lens.callStatic.getUserClaimableReward(rewardDistributor.address, user1Address, rewardToken.address)
            console.log('rewards:', rewards);
            
            await time.increase(week);
            rewards = await lens.callStatic.getUserClaimableReward(rewardDistributor.address, user1Address, rewardToken.address)
            console.log('rewards:', rewards);

            await time.increase(week);
            // rewards = await lens.callStatic.getUserClaimableReward(rewardDistributor.address, user1Address, rewardToken.address)
            // console.log('rewards:', rewards);
          });
        });
      });

      xdescribe('Fails with adding reward tokens', function () {
        it('Should NOT be able to add new reward token by non-admin', async () => {

          await expect(
            rewardDistributor.connect(user1)
              .addAllowedRewardTokens([bptToken.address])
            ).to.be.revertedWith('not admin');
        });

        it('Should NOT be able to add same reward token', async () => {

          await expect(rewardDistributor.connect(creator)
            .addAllowedRewardTokens([rewardToken.address])
          ).to.be.revertedWith('already exist');
  
        });
      });

    });
  });
});
