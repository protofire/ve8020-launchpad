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
  // @ts-ignore
  Launchpad, VotingEscrow,
  TestToken,
  BPTToken,
  RewardFaucet,
  BalancerToken,
  BalancerMinter,
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
let rewardFaucetFactory: ContractFactory;
let rewardFaucetImpl: RewardFaucet;

let launchpadFactory: ContractFactory;
let launchpad: Launchpad;

let balToken: BalancerToken;
let balMinter: BalancerMinter;

let DAY: number = 60 * 60 * 24;
let WEEK: number = 60 * 60 * 24 * 7;

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

    rewardFaucetFactory = await ethers.getContractFactory('RewardFaucet');
    rewardFaucetImpl = (await rewardFaucetFactory.deploy()) as RewardFaucet;

    const balFactory = await ethers.getContractFactory('BalancerToken');
    balToken = (await balFactory.deploy()) as BalancerToken;

    const balMinterFactory = await ethers.getContractFactory('BalancerMinter');
    balMinter = (await balMinterFactory.deploy(balToken.address)) as BalancerMinter;

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

    it('Should deploy empty RewardFaucet implementation', async () => {
      const rewardDistributor = await rewardFaucetImpl.rewardDistributor();
      const isInitialized = await rewardFaucetImpl.isInitialized();
      expect(rewardDistributor).to.equal(constants.AddressZero);
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
        constants.AddressZero,
        constants.AddressZero,
        maxLockTime,
        constants.AddressZero,
        constants.AddressZero,
        constants.AddressZero,
        false,
        constants.AddressZero,
      );

      const startTime = (await time.latest()) + WEEK * 3;
      await rewardDistributorImpl.initialize(
        votingEscrowImpl.address,
        rewardFaucetImpl.address,
        startTime,
        user2Address
      );

      await rewardFaucetImpl.initialize(
        votingEscrowImpl.address  // intentionally!
      );
    });

    it('Should return values of VE implementation', async () => {
      expect(await votingEscrowImpl.name()).to.equal('initName');
    });

    it('Should return values of RD implementation', async () => {
      expect(await rewardDistributorImpl.getVotingEscrow())
        .to.equal(votingEscrowImpl.address);
    });

    it('Should return values of RF implementation', async () => {
      expect(await rewardFaucetImpl.rewardDistributor())
        .to.equal(votingEscrowImpl.address);
    });
  });

  describe('Deploy Launchpad constraints', function () {
    it('Should not be unable to deploy launchpad with zero VE address', async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');

      await expect(launchpadFactory.deploy(
        constants.AddressZero,
        rewardDistributorImpl.address,
        rewardFaucetImpl.address,
        balToken.address,
        balMinter.address
        )).to.be.revertedWith('zero address');
    });

    it('Should not be unable to deploy launchpad with zero rewardDistributor address', async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');

      await expect(launchpadFactory.deploy(
        votingEscrowImpl.address,
        constants.AddressZero,
        rewardFaucetImpl.address,
        balToken.address,
        balMinter.address
        )).to.be.revertedWith('zero address');
    });

    it('Should not be unable to deploy launchpad with zero rewardFaucet address', async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');

      await expect(launchpadFactory.deploy(
        votingEscrowImpl.address,
        rewardDistributorImpl.address,
        constants.AddressZero,
        balToken.address,
        balMinter.address
        )).to.be.revertedWith('zero address');
    });

    it('Should not be unable to deploy launchpad with zero BAL token address', async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');

      await expect(launchpadFactory.deploy(
        votingEscrowImpl.address,
        rewardDistributorImpl.address,
        rewardFaucetImpl.address,
        constants.AddressZero,
        balMinter.address
        )).to.be.revertedWith('zero address');
    });

    it('Should not be unable to deploy launchpad with zero BalancerMinter address', async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');

      await expect(launchpadFactory.deploy(
        votingEscrowImpl.address,
        rewardDistributorImpl.address,
        rewardFaucetImpl.address,
        balToken.address,
        constants.AddressZero
        )).to.be.revertedWith('zero address');
    });
  });

  describe('Deploy Launchpad', function () {
    before(async () => {
      launchpadFactory = await ethers.getContractFactory('Launchpad');
      launchpad = (await launchpadFactory.deploy(
        votingEscrowImpl.address,
        rewardDistributorImpl.address,
        rewardFaucetImpl.address,
        balToken.address,
        balMinter.address
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

    it('Should set correct RewardFaucet implementation of launchpad', async () => {
      expect(await launchpad.rewardFaucet())
        .to.equal(rewardFaucetImpl.address);
    });

    it('Should set correct balToken and BalancerMinter addresses', async () => {
      expect(await launchpad.balToken())
        .to.equal(balToken.address);

      expect(await launchpad.balMinter())
        .to.equal(balMinter.address);
    });
  });

  describe('Deploy VE system constraints', function () {
    let name: string = 'MockName1';
    let symbol: string = 'MockSymbol1';
    let maxLockTime: number = 60 * 60 * 24 * 7; // week
    it('Should fail to create VE-System with incorrect token', async () => {
      const rewardStartTime = (await time.latest()) + 10000000;

      await expect(launchpad.deploy(
        rewardDistributorImpl.address,
        name,
        symbol,
        maxLockTime,
        rewardStartTime,
        constants.AddressZero,
        constants.AddressZero,
        constants.AddressZero
        )).to.be.reverted;
    });

    it('Should fail to create VE-System with incorrect reward startTime (0)', async () => {
      const rewardStartTime = 0;
      
      await expect(launchpad.deploy(
        bptToken.address,
        name,
        symbol,
        maxLockTime,
        rewardStartTime,
        constants.AddressZero,
        constants.AddressZero,
        constants.AddressZero
        )).to.be.revertedWith('Cannot start before current week');
    });

    it('Should fail to create VE-System with incorrect reward startTime (current)', async () => {
      let rewardStartTime = (await time.latest());
      
      await expect(launchpad.deploy(
        bptToken.address,
        name,
        symbol,
        maxLockTime,
        rewardStartTime,
        constants.AddressZero,
        constants.AddressZero,
        constants.AddressZero
        )).to.be.revertedWith('Zero total supply results in lost tokens');
    });

    it('Should fail to create VE-System with incorrect reward startTime (mare then 10 weeks)', async () => {
      let rewardStartTime = (await time.latest()) + WEEK * 12;
      
      await expect(launchpad.deploy(
        bptToken.address,
        name,
        symbol,
        maxLockTime,
        rewardStartTime,
        constants.AddressZero,
        constants.AddressZero,
        constants.AddressZero
        )).to.be.revertedWith('10 weeks delay max');
    });

    it('Should fail to create VE-System with low maxLockTime', async () => {
      let rewardStartTime = (await time.latest()) + 100000000;
      
      await expect(launchpad.deploy(
        bptToken.address,
        name,
        symbol,
        maxLockTime - 1,
        rewardStartTime,
        constants.AddressZero,
        constants.AddressZero,
        constants.AddressZero
        )).to.be.revertedWith('!maxlock');
    });
  });

  describe('Deploy VE system', function () {
    let veName = 'MockName1';
    let veSymbol = 'MockSymbol1';
    let txResult: ContractTransaction;
    let txReceipt: ContractReceipt;

    let votingEscrow: VotingEscrow;
    let rewardDistributor: RewardDistributor;
    let rewardFaucet: RewardFaucet;

    let rewardStartTime: number;
    let maxLockTime: number = 60 * 60 * 24 * 365; // year

    before(async () => {
      rewardStartTime = (await time.latest()) + WEEK;
      txResult = await launchpad.connect(creator).deploy(
        bptToken.address,
        veName,
        veSymbol,
        maxLockTime,
        rewardStartTime,
        user2Address,
        user1Address,
        creatorAddress
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
            // @ts-ignore
      expect(event.args.rewardFaucet)
        .to.not.equal(constants.AddressZero);
    });

    describe('Deployed system test', function () {
      before(async() => {
        // @ts-ignore
        const votingEscrowAdr = txReceipt.events[0].args.votingEscrow;
        // @ts-ignore
        const rewardDistributorAdr = txReceipt.events[0].args.rewardDistributor;
        // @ts-ignore
        const rewardFaucetAdr = txReceipt.events[0].args.rewardFaucet;

        votingEscrow = await ethers.getContractAt(
          'VotingEscrow',
          votingEscrowAdr
        );
        rewardDistributor = await ethers.getContractAt(
          'RewardDistributor',
          rewardDistributorAdr
        );
        rewardFaucet = await ethers.getContractAt(
          'RewardFaucet',
          rewardFaucetAdr
        );
      });

      it('Should return correct initial states for VotingEscrow', async () => {
        expect(await votingEscrow.name()).to.equal(veName);
        expect(await votingEscrow.symbol()).to.equal(veSymbol);

        expect(await votingEscrow.decimals())
          .to.equal(await bptToken.decimals());

        expect(await votingEscrow.token())
          .to.equal(bptToken.address);
      });

      it('Should return correct admins for VotingEscrow', async () => {
        expect(await votingEscrow.admin()).to.equal(creatorAddress);
        expect(await votingEscrow.admin_unlock_all()).to.equal(user2Address);
        expect(await votingEscrow.admin_early_unlock()).to.equal(user1Address);
      });

      it('Should return BAL properties of VotingEscrow', async () => {
        expect(await votingEscrow.balMinter())
          .to.equal(balMinter.address);

        expect(await votingEscrow.balToken())
          .to.equal(balToken.address);

        expect(await votingEscrow.rewardReceiver())
          .to.equal(creatorAddress);

        expect(await votingEscrow.rewardReceiverChangeable())
          .to.equal(true);
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
          constants.AddressZero,
          constants.AddressZero,
          maxLockTime,
          balToken.address,
          balMinter.address,
          creatorAddress,
          true,
          constants.AddressZero,
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

      it(`Shouldn't allow to initialize RewardDistributor again`, async () => {
        const newTime = (await time.latest()) + 10000001
        await expect(rewardDistributor.initialize(
          bptToken.address,
          rewardFaucet.address,
          newTime,
          creatorAddress
        ))
          .to.be.revertedWith('!twice');
      });

      it('Should NOT be able to deposit rewards into rewardDistributor', async () => {
        await time.increaseTo(rewardStartTime + 2000); // to allow deposit

        const depositAmount = utils.parseEther('1000');

        await rewardToken.connect(creator)
          .approve(rewardDistributor.address, depositAmount);

        await expect(
          rewardDistributor.connect(creator)
            .depositToken(rewardToken.address, depositAmount)
          ).to.be.revertedWith('!allowed');
      });

      it(`Shouldn't allow to initialize RewardFaucet again`, async () => {
        await expect(rewardFaucet.initialize(
          bptToken.address  // intentionally!
        ))
          .to.be.revertedWith('!twice');
      });

      it(`Should return correct rewardDistributor address in the RewardFaucet`, async () => {
        expect(await rewardFaucet.rewardDistributor())
          .to.equal(rewardDistributor.address);
      });

      describe('Adding reward tokens', function () {
        before(async() => {
          const depositAmount = utils.parseEther('1000');

          await rewardToken.connect(creator)
            .approve(rewardDistributor.address, depositAmount);

          await rewardDistributor.connect(creator)
            .addAllowedRewardTokens([rewardToken.address]);
        });

        it('Should be able to deposit rewards into rewardDistributor', async () => {
  
          const depositAmount = utils.parseEther('1000');
  
          await rewardToken.connect(creator)
            .approve(rewardDistributor.address, depositAmount);
  
          await rewardDistributor.connect(creator)
            .depositToken(rewardToken.address, depositAmount);
  
          expect(await rewardToken.balanceOf(rewardDistributor.address))
            .to.equal(depositAmount);
        })
      });

      describe('Fails with adding reward tokens', function () {
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

      describe('RewardDistributor admin functionality', function () {
        it('Should NOT transfer admin to zero address', async () => {

          await expect(rewardDistributor.connect(creator)
            .transferAdmin(constants.AddressZero)
          ).to.be.revertedWith('zero address');
        });

        it('Should NOT transfer admin to new address if caller is not admin', async () => {

          await expect(rewardDistributor.connect(user1)
            .transferAdmin(user2Address)
          ).to.be.revertedWith('not admin');
        });

        it('Should transfer admin rights to new user', async () => {
          await rewardDistributor.connect(creator)
            .transferAdmin(user2Address);

          expect(await rewardDistributor.admin()).to.equal(user2Address);
        });
      });
    });
  });
});
