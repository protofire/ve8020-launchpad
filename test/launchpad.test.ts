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
  ContractReceipt
} from "ethers";

import {
  RewardDistributor,
  Launchpad,
  VotingEscrow,
  TestToken,
  BPTToken,
} from "../typechain-types";


let owner: Signer;
let creator: Signer;
let user1: Signer;
let user2: Signer;

let ownerAddress: string;
let creatorAddress: string;
let user1Address: string;
let user2Address: string;

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

describe("Launchpad", function () {

  before(async () => {
    [owner, creator, user1, user2] = await ethers.getSigners();
    [ownerAddress, creatorAddress, user1Address, user2Address] = await Promise.all([
      owner.getAddress(),
      creator.getAddress(),
      user1.getAddress(),
      user2.getAddress(),
    ]);

    erc20Factory = await ethers.getContractFactory('TestToken');
    rewardToken = (await erc20Factory.deploy()) as TestToken;

    bptFactory = await ethers.getContractFactory('BPTToken');
    bptToken = (await bptFactory.deploy()) as BPTToken;

    veFactory = await ethers.getContractFactory('VotingEscrow');
    votingEscrowImpl = (await veFactory.deploy()) as VotingEscrow;

    rdFactory = await ethers.getContractFactory('RewardDistributor');
    rewardDistributorImpl = (await rdFactory.deploy()) as RewardDistributor;

    await rewardToken.mint(creatorAddress, utils.parseEther("2000"));
  });

  describe('Initial states', function() {
    it('Should deploy mock reward token', async () => {
      const name = await rewardToken.name();
      const symbol = await rewardToken.symbol();
      expect(name).to.equal('Token1');
      expect(symbol).to.equal('Symbl1');
    });

    it('Should deploy mock BPT token', async () => {
      const name = await bptToken.name();
      const symbol = await bptToken.symbol();
      expect(name).to.equal('BPTToken1');
      expect(symbol).to.equal('BPT1');
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


  describe('Deploy Launchpad constraints', function () {
    it('Should be unable to deploy launchpad with zero VE address', async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');

      await expect(launchpadFactory.deploy(
        constants.AddressZero,
        rewardDistributorImpl.address
        )).to.be.rejectedWith('zero address');
    });

    it('Should be unable to deploy launchpad with zero rewardDistributor address', async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');

      await expect(launchpadFactory.deploy(
        votingEscrowImpl.address,
        constants.AddressZero
        )).to.be.rejectedWith('zero address');
    });

    it('Should be unable to deploy launchpad with both zero addresses', async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');

      await expect(launchpadFactory.deploy(
        constants.AddressZero,
        constants.AddressZero
        )).to.be.revertedWith('zero address');
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

  describe('Deploy VE system constraints', function () {
    let name = 'MockName1';
    let symbol = 'MockSymbol1';
    
    it('Should fail to create VE-System with incorrect token', async () => {
      const rewardStartTime = (await time.latest()) + 10000000;

      await expect(launchpad.deploy(
        rewardDistributorImpl.address,
        name,
        symbol,
        rewardStartTime
        )).to.be.reverted;
    });

    it('Should fail to create VE-System with incorrect reward startTime (0)', async () => {
      const rewardStartTime = 0;
      
      await expect(launchpad.deploy(
        bptToken.address,
        name,
        symbol,
        rewardStartTime
        )).to.be.revertedWith('Cannot start before current week');
    });

    it('Should fail to create VE-System with incorrect reward startTime (current)', async () => {
      let rewardStartTime = (await time.latest());
      
      await expect(launchpad.deploy(
        bptToken.address,
        name,
        symbol,
        rewardStartTime
        )).to.be.revertedWith('Zero total supply results in lost tokens');
    });
  });

  describe('Deploy VE system', function () {
    let name = 'MockName1';
    let symbol = 'MockSymbol1';
    let txResult: ContractTransaction;
    let txReceipt: ContractReceipt;

    let votingEscrow: VotingEscrow;
    let rewardDistributor: RewardDistributor;

    before(async () => {
      const rewardStartTime = (await time.latest()) + 10000000;
      txResult = await launchpad.connect(creator).deploy(
        bptToken.address,
        name,
        symbol,
        rewardStartTime
      );
      txReceipt = await txResult.wait();
    });

    it("Should emit event on deployment", async () => {
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
  });

});
