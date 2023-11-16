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
        rewardStartTime
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

      it('Should return correct initial states penalty_k', async () => {
        expect(await votingEscrow.penalty_k()).to.equal(10);
      });

      it(`Should change penalty speed by admin`, async () => {
        const penaltyDefault = 10;
        const penaltyNew = 45;
        
        await votingEscrow.connect(creator).set_early_unlock_penalty_speed(penaltyNew);
        expect(await votingEscrow.penalty_k()).to.equal(penaltyNew);

        await votingEscrow.connect(creator).set_early_unlock_penalty_speed(penaltyDefault);
        expect(await votingEscrow.penalty_k()).to.equal(penaltyDefault);
      });

      it(`Shouldn't allow to call set_early_unlock() for non-admin`, async () => {
        await expect(votingEscrow.connect(user1).set_early_unlock(true))
          .to.be.revertedWith('!admin');
      });

      it(`Shouldn't allow to call set_early_unlock() with current value`, async () => {
        const currentEarlyUnlock = await votingEscrow.early_unlock();
        await expect(votingEscrow.connect(creator).set_early_unlock(currentEarlyUnlock))
          .to.be.revertedWith('already');
      });

      it(`Shouldn't allow to call set_early_unlock_penalty_speed() for non-admin`, async () => {
        await expect(votingEscrow.connect(user1).set_early_unlock_penalty_speed(5))
          .to.be.revertedWith('!admin');
      });

      it(`Shouldn't allow to call set_early_unlock_penalty_speed() more then 50`, async () => {
        await expect(votingEscrow.connect(creator).set_early_unlock_penalty_speed(51))
          .to.be.revertedWith('!k');
      });

      it(`Shouldn't allow to set penalty treasury for non-admin`, async () => {
        await expect(votingEscrow.connect(user1).set_penalty_treasury(user1Address))
          .to.be.revertedWith('!admin');
      });

      it(`Shouldn't allow to set penalty treasury to zero-address`, async () => {
        await expect(votingEscrow.connect(creator).set_penalty_treasury(constants.AddressZero))
          .to.be.revertedWith('!zero');
      });

      it(`Shouldn't allow to call set_all_unlock() for non-admin`, async () => {
        await expect(votingEscrow.connect(user1).set_all_unlock())
          .to.be.revertedWith('!admin');
      });


      describe('Users make locks (deposit)', function () {
        let createLockTime: number;

        before(async() => {
          // approvals before deposit
          await bptToken.connect(user1).approve(votingEscrow.address, constants.MaxUint256);
          await bptToken.connect(user2).approve(votingEscrow.address, constants.MaxUint256);

          // lock-deposit
          createLockTime = await time.latest();
          await votingEscrow.connect(user1).create_lock(user1Amount, createLockTime + WEEK * 8);
          await votingEscrow.connect(user2).create_lock(user2Amount, createLockTime + WEEK * 8);
        });

        it('Should return zero users balance after deposit', async () => {
          expect(await bptToken.balanceOf(user1Address)).to.equal(constants.Zero);
          expect(await bptToken.balanceOf(user2Address)).to.equal(constants.Zero);
        });

        it('Should increase votingEscrow balance', async () => {
          expect(await bptToken.balanceOf(votingEscrow.address))
            .to.equal(user1Amount.add(user2Amount));
        });

        it('Should create locks for users', async () => {
          const user1Lock = await votingEscrow.locked(user1Address);
          const user2Lock = await votingEscrow.locked(user2Address);

          expect(user1Lock[0]).to.equal(user1Amount);
          expect(user2Lock[0]).to.equal(user2Amount);

          // week rounding
          expect(user1Lock[1])
            .to.be.gt(BigNumber.from(createLockTime + WEEK * 7))
            .to.be.lt(BigNumber.from(createLockTime + WEEK * 9));
          expect(user2Lock[1])
            .to.be.gt(BigNumber.from(createLockTime + WEEK * 7))
            .to.be.lt(BigNumber.from(createLockTime + WEEK * 9));
        });

        describe('Trying to unlock before when not allowed', function() {
          before(async() => {
            await time.increase(DAY);
          });

          it("Should not be available to withdraw() when not allowed", async() => {
            await expect(votingEscrow.connect(user1).withdraw())
              .to.be.revertedWith("lock !expire or !unlock");
            
            await expect(votingEscrow.connect(user2).withdraw())
              .to.be.revertedWith("lock !expire or !unlock");
          });

          it("Should not be available to withdraw_early() when not allowed", async() => {
            await expect(votingEscrow.connect(user1).withdraw_early())
              .to.be.revertedWith("!early unlock");
            
            await expect(votingEscrow.connect(user2).withdraw_early())
              .to.be.revertedWith("!early unlock");
          });

        });

        describe('With enabled early unlock (with penalty) with high K-penalty', function () {
          before(async() => {
            await votingEscrow.connect(creator).set_early_unlock_penalty_speed(50);
            await votingEscrow.connect(creator).set_early_unlock(true);

            await time.increase(DAY * 2)

            await votingEscrow.connect(user1).withdraw_early();
          });

          it('Should turn on early unlock', async () => {
            expect(await votingEscrow.early_unlock()).to.equal(true);
          });

          it('Should increase k-penalty', async () => {
            expect(await votingEscrow.penalty_k()).to.equal(50);
          });


          it('Should charge all lock amount for penalty', async () => {
            expect(await bptToken.balanceOf(creatorAddress)).to.equal(user1Amount);
          });

          it('Should not return anything to user1', async () => {
            expect(await bptToken.balanceOf(user1Address)).to.equal(constants.Zero);
          });

          it('Should return correct sum balances of penalty and user1', async () => {
            const penalty = await bptToken.balanceOf(creatorAddress);
            const withdrawed = await bptToken.balanceOf(user1Address);
            expect(penalty.add(withdrawed)).to.equal(user1Amount);
          });

          it('Should close user1 lock', async () => {
            const user1Lock = await votingEscrow.locked(user1Address);
            expect(user1Lock[0]).to.equal(constants.Zero);
            expect(user1Lock[1]).to.equal(constants.Zero);
          });


          describe('When  K-penalty is zero and user2 withdraws early', function () {
            let user1BalanceBeforeLock: BigNumber;
            let createLockTime: number;

            before(async () => {
              await time.increase(DAY);
              await votingEscrow.connect(creator).set_early_unlock_penalty_speed(0);

              createLockTime = await time.latest();
              await votingEscrow.connect(user2).withdraw_early();
            });

            it('Should decrease k-penalty', async () => {
              expect(await votingEscrow.penalty_k()).to.equal(0);
            });

            it('Should return start balance of user2 k-penalty', async () => {
              expect(await bptToken.balanceOf(user2Address)).to.equal(user2Amount);
            });

            it('Should close user1 lock', async () => {
              const user2Lock = await votingEscrow.locked(user2Address);
              expect(user2Lock[0]).to.equal(constants.Zero);
              expect(user2Lock[1]).to.equal(constants.Zero);
            });

            describe('With new user2 lock', function () {
              before(async () => {
                await time.increase(DAY);
                const currentTime = await time.latest();
                await votingEscrow.connect(creator).set_early_unlock_penalty_speed(10);
                await votingEscrow.connect(user2).create_lock(user2Amount, currentTime + WEEK * 2);
              });

              it('Should set default k-penalty', async () => {
                expect(await votingEscrow.penalty_k()).to.equal(10);
              });

              it('Should create new lock for user 2', async () => {
                expect(await bptToken.balanceOf(user2Address)).to.equal(constants.Zero);
                const user2Lock = await votingEscrow.locked(user2Address);
                expect(user2Lock[0]).to.equal(user2Amount);
              });

              describe('Withdraws without penalty when lock is expired', function () {

                before(async () => {
                  await time.increase(WEEK * 3);
                });

                it(`Should not be possible to use withdraw_early(), because lock expired`, async () => {
                  await expect(votingEscrow.connect(user2).withdraw_early())
                    .to.be.revertedWith("lock expired");
                })

                it(`Should be possible to use withdraw(), when lock expired`, async () => {
                  await votingEscrow.connect(user2).withdraw();

                  expect(await bptToken.balanceOf(user2Address)).to.equal(user2Amount);
                  const user2Lock = await votingEscrow.locked(user2Address);
                  expect(user2Lock[0]).to.equal(constants.Zero);

                })
              });

            });
          });    
        });
      });
    });
  });
});
