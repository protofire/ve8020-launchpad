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


describe("Launchpad flow test 3 with multiple rewards", function () {

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
    await rewardTokenA.mint(creatorAddress, totalRewardAmountA);
    totalRewardAmountB = utils.parseEther("50000")
    await rewardTokenB.mint(creatorAddress, totalRewardAmountB);
    
    user1Amount = utils.parseEther('2000');
    user2Amount = utils.parseEther('1000');
    await bptToken.mint(user1Address, user1Amount);
    await bptToken.mint(user2Address, user2Amount);

    await bptToken.mint(user3Address, 1);

  });

  describe('Initial states', function() {
    it('Should mint initial token balances', async () => {

      expect(await rewardTokenA.balanceOf(creatorAddress)).to.equal(totalRewardAmountA);
      expect(await rewardTokenB.balanceOf(creatorAddress)).to.equal(totalRewardAmountB);
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
        constants.AddressZero,
        constants.AddressZero,
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
    let maxLockTime: number = DAY * 60; // 60 days

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
          constants.AddressZero,
          constants.AddressZero,
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

      describe('Users make locks', function () {
        let createLockTime: number;

        before(async() => {
          // approvals before deposit
          await bptToken.connect(user1).approve(votingEscrow.address, constants.MaxUint256);
          await bptToken.connect(user2).approve(votingEscrow.address, constants.MaxUint256);
          await bptToken.connect(user3).approve(votingEscrow.address, constants.MaxUint256);

          // lock-deposit
          createLockTime = await time.latest();
          await votingEscrow.connect(user1).create_lock(user1Amount, createLockTime + WEEK * 3);
          await votingEscrow.connect(user2).create_lock(user2Amount, createLockTime + WEEK * 6);
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

      describe('Adding reward token A', function () {
        let startRewardTime: number;

        before(async() => {
          const depositAmountA = totalRewardAmountA.div(2);

          await rewardTokenA.connect(creator)
            .approve(rewardDistributor.address, constants.MaxUint256);
          await rewardTokenB.connect(creator)
            .approve(rewardDistributor.address, constants.MaxUint256);

          await rewardDistributor.connect(creator)
            .addAllowedRewardTokens([rewardTokenA.address, rewardTokenB.address]);
          
          startRewardTime = (await rewardDistributor.getTimeCursor()).toNumber();

          await time.increaseTo(startRewardTime);

          await rewardDistributor.connect(creator)
            .depositToken(rewardTokenA.address, depositAmountA);
        });

        it('Should add allowed tokens to the rewardDistributor', async () => {
          const allowedTokens = await rewardDistributor.getAllowedRewardTokens();

          expect(allowedTokens[0]).to.equal(rewardTokenA.address);
          expect(allowedTokens[1]).to.equal(rewardTokenB.address);
        });

        it('Should be able to deposit rewards into rewardDistributor', async () => {

          expect(await rewardTokenA.balanceOf(rewardDistributor.address))
            .to.equal(totalRewardAmountA.div(2));
        });

        describe('Claim rewards-A after first WEEK past', function () {
          before(async () => {
            await time.increase(WEEK);
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

            // add 1 due to rounding
            expect(
              user1rewards[0].claimableAmount
                .add(user2rewards[0].claimableAmount)
                .add(constants.One)
            ).to.equal(totalRewardAmountA.div(2));

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

            it('Should increase reward balance after claim', async () => {
              const user1RewardAfter = await rewardTokenA.balanceOf(user1Address);
              const user2RewardAfter = await rewardTokenA.balanceOf(user2Address);
              expect(user1RewardAfter).to.be.gt(user1RewardBefore).to.be.gt(constants.Two);
              expect(user2RewardAfter).to.be.gt(user2RewardBefore).to.be.gt(constants.Two);

              expect(
                user1RewardAfter.add(user2RewardAfter).add(constants.One)
              ).to.equal(totalRewardAmountA.div(2));
            });
          });

          describe('Adding rewards A and B for the second WEEK', function () {
            before(async () => {
              const depositAmountA = totalRewardAmountA.div(2);
              await rewardDistributor.connect(creator)
                .depositToken(rewardTokenA.address, depositAmountA);
              
              await rewardDistributor.connect(creator)
                .depositToken(rewardTokenB.address, totalRewardAmountB);
            });

            it('Should be able to deposit rewards into rewardDistributor', async () => {

              expect(await rewardTokenA.balanceOf(rewardDistributor.address))
                .to.equal(totalRewardAmountA.div(2).add(constants.One));

              expect(await rewardTokenB.balanceOf(rewardDistributor.address))
                .to.equal(totalRewardAmountB);
            });

            describe('Check available rewards after second WEEK past', function () {
              before(async () => {
                await time.increase(WEEK * 2);
                const currentTime = await time.latest()

              });

              it('Should calculate correct claimable amounts of reward using Lens', async () => {

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

                const totalRewardsA = user1rewards[0].claimableAmount
                  .add(user2rewards[0].claimableAmount);
                const totalRewardsB = user1rewards[1].claimableAmount
                  .add(user2rewards[1].claimableAmount);

                expect(totalRewardsA.add(constants.One)).to.equal(totalRewardAmountA.div(2));
                expect(totalRewardsB.add(constants.One)).to.equal(totalRewardAmountB);
              });

              describe('Claim process after few weeks more', function () {
                before(async () => {
                  await time.increase(WEEK * 4);

                  await rewardDistributor.connect(user1)
                    .claimTokens(user1Address, [rewardTokenA.address, rewardTokenB.address]);
                  await rewardDistributor.connect(user2)
                    .claimTokens(user2Address, [rewardTokenA.address, rewardTokenB.address]);
                });

                it('Should claim all reward-A tokens', async () => {
                  const user1RewardBalance = await rewardTokenA.balanceOf(user1Address);
                  const user2RewardBalance = await rewardTokenA.balanceOf(user2Address);
                  const distributorRewardBalance = await rewardTokenA.balanceOf(
                    rewardDistributor.address
                  );

                  expect(
                    user1RewardBalance.add(user2RewardBalance).add(constants.Two)
                  ).to.be.gte(totalRewardAmountA);
                  expect(distributorRewardBalance).to.be.lte(constants.Two);
                });

                it('Should claim all reward-B tokens', async () => {
                  const user1RewardBalance = await rewardTokenB.balanceOf(user1Address);
                  const user2RewardBalance = await rewardTokenB.balanceOf(user2Address);
                  const distributorRewardBalance = await rewardTokenB.balanceOf(
                    rewardDistributor.address
                  );

                  expect(
                    user1RewardBalance.add(user2RewardBalance).add(constants.One)
                  ).to.equal(totalRewardAmountB);
                  expect(distributorRewardBalance).to.be.lte(constants.One);

                });

                it('Should return greater balance for user 2, because of longest locktime', async () => {
                  const user1RewardBalance = await rewardTokenB.balanceOf(user1Address);
                  const user2RewardBalance = await rewardTokenB.balanceOf(user2Address);

                  expect(user2RewardBalance).to.be.gt(user1RewardBalance);
                });
              });

              describe('Withdraw bpt tokens when locks finished', function () {
                let bptBalance1Before: BigNumber;
                let bptBalance2Before: BigNumber;
                let veBptBlanctBefore: BigNumber;

                before(async () => {
                  await time.increase(WEEK * 4);

                  bptBalance1Before = await bptToken.balanceOf(user1Address);
                  bptBalance2Before = await bptToken.balanceOf(user2Address);
                  veBptBlanctBefore = await bptToken.balanceOf(votingEscrow.address);

                  await votingEscrow.connect(user1).withdraw();
                  await votingEscrow.connect(user2).withdraw();
                });

                it('Should decrease voting escrow bpt balance', async () => {
                  const veBptBalanceAfter = await bptToken.balanceOf(votingEscrow.address);

                  expect(veBptBalanceAfter).to.be.lt(veBptBlanctBefore);
                  expect(veBptBalanceAfter).to.equal(constants.Zero);
                });

                it('Should return all bpt tokens to the users', async () => {
                  const bptBalance1After = await bptToken.balanceOf(user1Address);
                  const bptBalance2After = await bptToken.balanceOf(user2Address);
                  expect(bptBalance1After).to.be.gt(bptBalance1Before);
                  expect(bptBalance1After).to.equal(user1Amount);

                  expect(bptBalance2After).to.be.gt(bptBalance2Before);
                  expect(bptBalance2After).to.equal(user2Amount);

                });
              });
            });
          });
        });
      });
    });
  });
});
