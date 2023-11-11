import { time } from "@nomicfoundation/hardhat-network-helpers";
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

let erc20Factory: ContractFactory;
let rewardTokenA: TestToken;
let rewardTokenB: TestToken;
let totalRewardAmountA: BigNumber;
let totalRewardAmountB: BigNumber;

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


describe("RewardFaucet tests", function () {

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
    rewardTokenA = (await erc20Factory.deploy()) as TestToken;
    rewardTokenB = (await erc20Factory.deploy()) as TestToken;

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

    totalRewardAmountA = utils.parseEther("10000")
    await rewardTokenA.mint(creatorAddress, totalRewardAmountA.add(1));
    totalRewardAmountB = utils.parseEther("50000")
    await rewardTokenB.mint(creatorAddress, totalRewardAmountB);
    
    user1Amount = utils.parseEther('2000');
    user2Amount = utils.parseEther('1000');
    await bptToken.mint(user1Address, user1Amount);
    await bptToken.mint(user2Address, user2Amount);

    await bptToken.mint(user3Address, 1);

  });

  describe('Initial states', function() {
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

    it('Should set correct RewardFaucet implementation of launchpad', async () => {
      expect(await launchpad.rewardFaucet())
        .to.equal(rewardFaucetImpl.address);
    });
  });


  describe('Deploy VE system', function () {
    let veName = 'Lock system 4';
    let veSymbol = 'LS_4';
    let txResult: ContractTransaction;
    let txReceipt: ContractReceipt;

    let votingEscrow: VotingEscrow;
    let rewardDistributor: RewardDistributor;
    let rewardFaucet: RewardFaucet;

    let rewardStartTime: number;
    let maxLockTime: number = WEEK * 16; // ~4 months

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


      it('Should return correct of the VotingEscrow for the rewardDistributor', async () => {
        expect(await rewardDistributor.getVotingEscrow())
          .to.equal(votingEscrow.address);
      });

      it('Should return non-zero timeCursor of the VotingEscrow', async () => {
        expect(await rewardDistributor.getTimeCursor())
          .to.be.gt(await time.latest());
      });

      it('Should return correct rewardFaucet of the RewardDistributor', async () => {
        expect(await rewardDistributor.rewardFaucet())
          .to.equal(rewardFaucet.address);
      });

      it('Should return correct rewardDistributor of the RewardFaucet', async () => {
        expect(await rewardFaucet.rewardDistributor())
          .to.equal(rewardDistributor.address);
      });

      describe('Users make locks', function () {
        let createLockTime: number;

        before(async() => {
          // approvals before locks
          await bptToken.connect(user1).approve(votingEscrow.address, constants.MaxUint256);
          await bptToken.connect(user2).approve(votingEscrow.address, constants.MaxUint256);
          await bptToken.connect(user3).approve(votingEscrow.address, constants.MaxUint256);

          // lock-deposit
          createLockTime = await time.latest();
          await votingEscrow.connect(user1).create_lock(user1Amount, createLockTime + WEEK * 4);
          await votingEscrow.connect(user2).create_lock(user2Amount, createLockTime + WEEK * 12);
        });

        it('Should return zero balance after deposit', async () => {
          expect(await bptToken.balanceOf(user1Address)).to.equal(constants.Zero);
          expect(await bptToken.balanceOf(user2Address)).to.equal(constants.Zero);
        });

        it('Should increase votingEscrow balance', async () => {
          expect(await bptToken.balanceOf(votingEscrow.address))
            .to.equal(user1Amount.add(user2Amount));
        })

      });

      describe('Adding rewards into RewardFaucet', function () {
        let startRewardTime: number;
        let depositAmountA: BigNumber;

        before(async() => {
          depositAmountA = totalRewardAmountA.div(2); // 10000 / 2

          // approvals
          await rewardTokenA.connect(creator)
            .approve(rewardFaucet.address, constants.MaxUint256);
          await rewardTokenB.connect(creator)
            .approve(rewardFaucet.address, constants.MaxUint256);

          // add available reward tokens
          await rewardDistributor.connect(creator)
            .addAllowedRewardTokens([rewardTokenA.address, rewardTokenB.address]);
          
          startRewardTime = (await rewardDistributor.getTimeCursor()).toNumber();
          await time.increaseTo(startRewardTime);

          await rewardFaucet.connect(creator)
            .depositEqualWeeksPeriod(rewardTokenA.address, depositAmountA, 5);
        });

        it('Should add allowed tokens to the rewardDistributor', async () => {
          const allowedTokens = await rewardDistributor.getAllowedRewardTokens();

          expect(allowedTokens[0]).to.equal(rewardTokenA.address);
          expect(allowedTokens[1]).to.equal(rewardTokenB.address);
        });

        it('Should increase rewards in the rewardFaucet', async () => {
          expect(await rewardTokenA.balanceOf(rewardFaucet.address))
            .to.equal(depositAmountA.mul(4).div(5));

          expect(await rewardFaucet.totalTokenRewards(rewardTokenA.address))
            .to.equal(depositAmountA.mul(4).div(5));
        });

        it('Should return rewards for upcoming next 6 weeks', async () => {
          const rewards = await rewardFaucet.getUpcomingRewardsForNWeeks(rewardTokenA.address, 6);
          expect(rewards[0]).to.equal(constants.Zero); // already distributed
          expect(rewards[1]).to.equal(depositAmountA.div(5));
          expect(rewards[2]).to.equal(depositAmountA.div(5));
          expect(rewards[3]).to.equal(depositAmountA.div(5));
          expect(rewards[4]).to.equal(depositAmountA.div(5));
          expect(rewards[5]).to.equal(constants.Zero); // distribution was only for 6th week is empty
        });

        it('Should distribute rewards evenly over 5 weeks', async () => {
          const currTime = await time.latest();
          expect(await rewardFaucet.getTokenWeekAmounts(rewardTokenA.address, currTime))
            .to.equal(constants.Zero);
          expect(await rewardFaucet.getTokenWeekAmounts(rewardTokenA.address, currTime + WEEK))
            .to.equal(depositAmountA.div(5));
          expect(await rewardFaucet.getTokenWeekAmounts(rewardTokenA.address, currTime + WEEK * 2))
            .to.equal(depositAmountA.div(5));
          expect(await rewardFaucet.getTokenWeekAmounts(rewardTokenA.address, currTime + WEEK * 3))
            .to.equal(depositAmountA.div(5));
          expect(await rewardFaucet.getTokenWeekAmounts(rewardTokenA.address, currTime + WEEK * 4))
            .to.equal(depositAmountA.div(5));

          // sixth is zero
          expect(await rewardFaucet.getTokenWeekAmounts(rewardTokenA.address, currTime + WEEK * 5))
            .to.equal(constants.Zero);
        });

        describe('Adding same rewards for same period with 1 leftovers', function () {
          before(async() => {
            await rewardFaucet.connect(creator)
              .depositEqualWeeksPeriod(rewardTokenA.address, depositAmountA.add(1), 5);
          });
  
          it('Should increase rewards in the rewardFaucet', async () => {
            expect(await rewardTokenA.balanceOf(rewardFaucet.address))
              .to.equal(totalRewardAmountA.mul(4).div(5).add(1)); // leftovers
  
            expect(await rewardFaucet.totalTokenRewards(rewardTokenA.address))
              .to.equal(totalRewardAmountA.mul(4).div(5).add(1)); // leftovers
            });
  
          it('Should return rewards for upcoming next 6 weeks', async () => {
            const rewards = await rewardFaucet.getUpcomingRewardsForNWeeks(rewardTokenA.address, 6);
            expect(rewards[0]).to.equal(constants.Zero); // already distributed
            expect(rewards[1]).to.equal(totalRewardAmountA.div(5));
            expect(rewards[2]).to.equal(totalRewardAmountA.div(5));
            expect(rewards[3]).to.equal(totalRewardAmountA.div(5));
            expect(rewards[4]).to.equal(totalRewardAmountA.div(5).add(1)); // leftovers
            expect(rewards[5]).to.equal(constants.Zero); // distribution was only for 6th week is empty
          });

        });

        describe('Claim rewards-A after first WEEK past', function () {
          before(async () => {
            await time.increase(WEEK * 1);
          });

          it('Should calculate correct claimable amounts of reward using lens', async () => {

            const user1rewards = (
              await lens.callStatic.getUserClaimableRewardsAll(
                rewardDistributor.address,
                user1Address,
                [rewardTokenA.address, rewardTokenB.address]
                )
              );

            const user2rewards = (
              await lens.callStatic.getUserClaimableRewardsAll(
                rewardDistributor.address,
                user2Address,
                [rewardTokenA.address, rewardTokenB.address]
                )
              );

            // console.log('user1rewards:', user1rewards);
            // console.log('user2rewards:', user2rewards);

            // add 1 due to rounding
            expect(
              user1rewards[0].claimableAmount
                .add(user2rewards[0].claimableAmount)
                .add(constants.One)
            ).to.equal(totalRewardAmountA.div(5));

            // rewardB
            expect(user1rewards[1].claimableAmount).to.equal(constants.Zero);
            expect(user2rewards[1].claimableAmount).to.equal(constants.Zero);

            // check tokens
            expect(user1rewards[0].token).to.equal(user2rewards[0].token)
              .to.equal(rewardTokenA.address);
            expect(user1rewards[1].token).to.equal(user2rewards[1].token)
              .to.equal(rewardTokenB.address);
          });

          describe('Rewards claiming', function () {
            let user1RewardBefore: BigNumber;
            let user2RewardBefore: BigNumber;

            before(async () => {
              user1RewardBefore = await rewardTokenA.balanceOf(user1Address);
              user2RewardBefore = await rewardTokenA.balanceOf(user2Address);

              await rewardDistributor.connect(user1)
                .claimToken(user1Address, rewardTokenA.address);
              await rewardDistributor.connect(user2)
                .claimToken(user2Address, rewardTokenA.address);
            });

            it(`Should increase user's reward balance after claim`, async () => {
              // console.log('balance2', await rewardTokenA.balanceOf(rewardDistributor.address))
              // console.log('balance2', await rewardTokenA.balanceOf(rewardFaucet.address))

              const user1RewardAfter = await rewardTokenA.balanceOf(user1Address);
              const user2RewardAfter = await rewardTokenA.balanceOf(user2Address);
              expect(user1RewardAfter).to.be.gt(user1RewardBefore).to.be.gt(constants.Two);
              expect(user2RewardAfter).to.be.gt(user2RewardBefore).to.be.gt(constants.Two);

              expect(
                user1RewardAfter.add(user2RewardAfter).add(constants.One)  // rounding
              ).to.equal(totalRewardAmountA.div(5));
            });
          });

          describe('Adding 1/2 rewards B into Exact week with direct transfer', function () {
            before(async () => {
              const currentTime = (await time.latest()) + 60;
              await rewardTokenB.connect(creator)
                .transfer(rewardFaucet.address, totalRewardAmountB.div(4))
              await rewardFaucet.connect(creator)
                .depositExactWeek(rewardTokenB.address, totalRewardAmountB.div(4), currentTime);
            });

            it('Should increase balance of the rewardDistributor', async () => {
              expect(await rewardTokenB.balanceOf(rewardDistributor.address))
                .to.equal(totalRewardAmountB.div(2));
            });

            it('Should not increase balance of the rewardFaucet because all rewards were transferred directly', async () => {
              expect(await rewardTokenB.balanceOf(rewardFaucet.address))
                .to.equal(constants.Zero);
              
              expect(await rewardFaucet.totalTokenRewards(rewardTokenB.address))
                .to.equal(constants.Zero);
            });
          });

          describe('Adding rest of rewards B into Exact week', function () {
            let laterWeek: number;
            let rewardDistributorBalance: BigNumber;
            before(async () => {
              rewardDistributorBalance = await rewardTokenB.balanceOf(rewardDistributor.address); 

              laterWeek = (await time.latest()) + WEEK * 2 + 60;
              await rewardFaucet.connect(creator)
                .depositExactWeek(rewardTokenB.address, totalRewardAmountB.div(2), laterWeek);
            });

            it('Should return balance of the rewardDistributor without changes', async () => {
              expect(await rewardTokenB.balanceOf(rewardDistributor.address))
                .to.equal(rewardDistributorBalance)
                .to.equal(totalRewardAmountB.div(2));
            });

            it('Should increase balance of the rewardFaucet', async () => {
              expect(await rewardTokenB.balanceOf(rewardFaucet.address))
                .to.equal(totalRewardAmountB.div(2));

              expect(await rewardFaucet.totalTokenRewards(rewardTokenB.address))
                .to.equal(totalRewardAmountB.div(2));
            });

            it('Should return correct reward amount for exact week (reward-B)', async () => {
              expect(await rewardTokenB.balanceOf(rewardFaucet.address))
                .to.equal(totalRewardAmountB.div(2));

              expect(await rewardFaucet.getTokenWeekAmounts(rewardTokenB.address, laterWeek))
                .to.equal(totalRewardAmountB.div(2));
            });

            describe('Claiming rewards after 2 weeks of "vacation"', function () {
              let faucetRewardsA: BigNumber;
              let faucetRewardsB: BigNumber;

              let rdBalanceBeforeA: BigNumber;
              let rdBalanceBeforeB: BigNumber;

              let user1availableClaimA: BigNumber;
              let user1availableClaimB: BigNumber;


              before(async () => {
                faucetRewardsA = await rewardTokenA.balanceOf(rewardFaucet.address);
                faucetRewardsB = await rewardTokenB.balanceOf(rewardFaucet.address);

                for (let i = 3; i <= 5; i++) {
                  await time.increase(WEEK * i);
                  await rewardDistributor.connect(user1)
                    .claimTokens(user1Address, [rewardTokenA.address, rewardTokenB.address]);
                  await rewardDistributor.connect(user2)
                    .claimTokens(user2Address, [rewardTokenA.address, rewardTokenB.address]);
                }

              });

              it('Should drain all rewards from RewardFaucet', async () => {
                expect(await rewardTokenA.balanceOf(rewardFaucet.address))
                  .to.equal(constants.Zero);
                expect(await rewardTokenB.balanceOf(rewardFaucet.address))
                  .to.equal(constants.Zero);

                expect(await rewardFaucet.totalTokenRewards(rewardTokenA.address))
                  .to.equal(constants.Zero);
                expect(await rewardFaucet.totalTokenRewards(rewardTokenB.address))
                  .to.equal(constants.Zero);

              });

              it('Should drain all rewards from RewardDistributor', async () => {
                expect(await rewardTokenA.balanceOf(rewardDistributor.address))
                  .to.be.lt(constants.Zero.add(4)); // rounding
                expect(await rewardTokenB.balanceOf(rewardDistributor.address))
                  .to.be.lt(constants.Zero.add(4)); // rounding
              });

              it('Should return correct total rewards A for users', async () => {
                const user1BalanceA = await rewardTokenA.balanceOf(user1Address);
                const user2BalanceA = await rewardTokenA.balanceOf(user2Address)

                expect(user1BalanceA.add(user2BalanceA))
                  .to.be.gt(totalRewardAmountA.sub(5)); // rounding
              });

              it('Should return correct total rewards B for users', async () => {
                const user1BalanceB = await rewardTokenB.balanceOf(user1Address);
                const user2BalanceB = await rewardTokenB.balanceOf(user2Address)

                expect(user1BalanceB.add(user2BalanceB))
                  .to.be.gt(totalRewardAmountB.sub(5)); // rounding
              });
            });
          });
        });
      });
    });
  });
});
