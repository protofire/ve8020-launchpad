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
  // @ts-ignore
  Launchpad, VotingEscrow,
  TestToken,
  BPTToken,
  SmartWalletWhitelist,
  SmartWalletChecker,
  LensReward,
  RewardFaucet,
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
let rewardFaucetFactory: ContractFactory;
let rewardFaucetImpl: RewardFaucet;

let launchpadFactory: ContractFactory;
let launchpad: Launchpad;

let lens: LensReward;

let smartWalletChecker: SmartWalletWhitelist;
let smartCheckerAllower: SmartWalletChecker;

let DAY: number = 60 * 60 * 24;
let WEEK: number = 60 * 60 * 24 * 7;


describe("Lock-cancel unit tests", function () {

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

    rewardFaucetFactory = await ethers.getContractFactory('RewardFaucet');
    rewardFaucetImpl = (await rewardFaucetFactory.deploy()) as RewardFaucet;

    const smartCheckerFactory = await ethers.getContractFactory('SmartWalletWhitelist');
    smartWalletChecker = (await smartCheckerFactory.deploy(creatorAddress)) as SmartWalletWhitelist;

    const smartCheckerAllowerFactory = await ethers.getContractFactory('SmartWalletChecker');
    smartCheckerAllower = (await smartCheckerAllowerFactory.deploy()) as SmartWalletChecker;

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
      let maxLockTime: number = 60 * 60 * 24 * 7; // WEEK
      await votingEscrowImpl.initialize(
        bptToken.address,
        'initName',
        'initSymbol',
        user2Address,
        user1Address,
        user1Address,
        maxLockTime
      );

      const startTime = (await time.latest()) + 99999999999;
      await rewardDistributorImpl.initialize(
        votingEscrowImpl.address,
        rewardFaucetImpl.address,
        startTime,
        user2Address
      );

      await rewardFaucetImpl.initialize(
        rewardDistributorImpl.address
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
        rewardDistributorImpl.address,
        rewardFaucetImpl.address
        )) as Launchpad;
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
    let maxLockTime: number = WEEK * 8; // 30 days

    before(async () => {
      rewardStartTime = (await time.latest()) + WEEK;

      txResult = await launchpad.connect(creator).deploy(
        bptToken.address,
        veName,
        veSymbol,
        maxLockTime,
        rewardStartTime,
        creatorAddress,
        creatorAddress
      );
      txReceipt = await txResult.wait();
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

      it('Should return correct initial states for VotingEscrow unlocks', async () => {
        expect(await votingEscrow.early_unlock()).to.equal(false);
        expect(await votingEscrow.all_unlock()).to.equal(false);
      });

      it('Should return correct admin ', async () => {
        expect(await votingEscrow.admin()).to.equal(creatorAddress);
      });

      it('Should not be possible to call commit_transfer_ownership by non-admin ', async () => {
        await expect(votingEscrow.connect(user1).commit_transfer_ownership(user2Address))
          .to.be.revertedWithoutReason();
      });

      it('Should not be possible to call apply_transfer_ownership by non-admin', async () => {
        await expect(votingEscrow.connect(user1).apply_transfer_ownership())
          .to.be.revertedWithoutReason();
      });

      it('Should return zero-address for the future admin', async () => {
        expect(await votingEscrow.future_admin()).to.equal(constants.AddressZero);
      });

      describe('Commit new admin ', function () {
        let createLockTime: number;

        before(async() => {
          await votingEscrow.connect(creator).commit_transfer_ownership(user2Address);
        });

        it('Should return user2address as new admin', async () => {
          expect(await votingEscrow.future_admin()).to.equal(user2Address);
        });

        it('Should not be possible to call apply_transfer_ownership() for future admin', async () => {
          await expect(votingEscrow.connect(user2).apply_transfer_ownership())
            .to.be.revertedWithoutReason();
        });

        describe('Apply new admin', function () {
          before(async() => {
            
            await votingEscrow.connect(creator).apply_transfer_ownership();
          });

          it('Should return new admin', async () => {
            expect(await votingEscrow.admin()).to.equal(user2Address);
          });

        });

      });
    });
  });
});
