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
} from "ethers";

import {
  RewardDistributor,
  Launchpad,
  VotingEscrow,
  TestToken,
  BPTToken,
} from "../typechain-types";

function dataFromEvent(event: any): string {
  const requestKey = event.data.slice(66);
  return `0x${requestKey}`;
}

let owner: Signer;
let creator: Signer;
let user1: Signer;
let user2: Signer;

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

    erc20Factory = await ethers.getContractFactory('TestToken');
    rewardToken = (await erc20Factory.deploy()) as TestToken;

    bptFactory = await ethers.getContractFactory('BPTToken');
    bptToken = (await bptFactory.deploy()) as BPTToken;

    veFactory = await ethers.getContractFactory('VotingEscrow');
    votingEscrowImpl = (await veFactory.deploy()) as VotingEscrow;

    rdFactory = await ethers.getContractFactory('RewardDistributor');
    rewardDistributorImpl = (await rdFactory.deploy()) as RewardDistributor;

    // await rewardToken.mi
  });

  describe("State of deployment implementations", function () {


    it("Should set the right unlockTime", async function () {
      const { token, owner } = await loadFixture(deployToken);
      const TokenFactory = await ethers.getContractFactory("TestToken");
      const token2 = await TokenFactory.deploy();
      console.log('token', token.address);
      console.log('token2', token2.address);


      expect(await token.decimals()).to.equal(18);
      console.log('done');

      const name: string = 'VotingEscrow';
      const symbol: string = 'VE';

      console.log('before factory');
      const VotingEscrowFactory = await ethers.getContractFactory("VotingEscrow");
      console.log('after factory');
      const veImpl = await VotingEscrowFactory.deploy();

      
      const RewardDistributorFactory = await ethers.getContractFactory("RewardDistributor");
      const rewardDistributorImpl = await RewardDistributorFactory.deploy();


      console.log('deploy ve factory');
      const VEFactory = await ethers.getContractFactory("Launchpad");
      const launchpad = await VEFactory.deploy(veImpl.address, rewardDistributorImpl.address);
      console.log('launchpad', launchpad.address)
      console.log('launchpad.ve', await launchpad.votingEscrow())
      console.log('launchpad.rd', await launchpad.rewardDistributor())


      console.log('launch:');
      const txResult = await launchpad.deploy1(token2.address, 'VE1name', 'VE1symbol', 1694349020+999900);
      let txReceipt = await txResult.wait();
      console.log('events: ', txReceipt.events[0].args);
      const ve1 = await ethers.getContractAt('VotingEscrow', '0x856e4424f806D16E8CBC702B3c0F2ede5468eae5')
      const rd1 = await ethers.getContractAt('RewardDistributor', '0xb0279Db6a2F1E01fbC8483FCCef0Be2bC6299cC3')
      console.log('ve1.name', await ve1.name());
      console.log('rd1.ve:', await rd1.getVotingEscrow());

      const txResult2 = await launchpad.deploy1(token2.address, 'VE2name', 'VE2symbol', 1694349020+999900);
      let txReceipt2 = await txResult2.wait();
      console.log('events: ', txReceipt2.events[0].args);
      const ve2 = await ethers.getContractAt('VotingEscrow', '0x3dE2Da43d4c1B137E385F36b400507c1A24401f8')
      const rd2 = await ethers.getContractAt('RewardDistributor', '0xddEA3d67503164326F90F53CFD1705b90Ed1312D')
      console.log('ve2.name', await ve2.name());
      console.log('rd2.ve:', await rd2.getVotingEscrow());


      // const txResult11 = await launchpad.deploy11(token.address);
      // let txReceipt11 = await txResult11.wait();
      // console.log('events: ', txReceipt11.events[0].args);
      // const tokenCopy = await ethers.getContractAt('TestToken', '0x9409fcA4c8899dc5Ec1142E24C4136F3B79Ef226')
      // console.log('ve1.name', await tokenCopy.name())


      // let events = txReceipt.events?.filter(
      //   (event: any) => event.topics[0] === createIncreasePositionEvent
      // );



      // console.log('launch:');
      // const txResult = await launchpad.deploy2(token2.address);
      // console.log('txResult', txResult)
      // let txReceipt = await txResult.wait();
      // console.log('events: ', txReceipt.events);
    });
  });


});
