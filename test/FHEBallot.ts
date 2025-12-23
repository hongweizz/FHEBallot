import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { FHEBallot, FHEBallot__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEBallot")) as FHEBallot__factory;
  const ballot = (await factory.deploy()) as FHEBallot;
  const ballotAddress = await ballot.getAddress();

  return { ballot, ballotAddress };
}

describe("FHEBallot", function () {
  let signers: Signers;
  let ballot: FHEBallot;
  let ballotAddress: string;
  let totalQuestions: number;

  before(async function () {
    const [deployer, alice, bob] = await ethers.getSigners();
    signers = { deployer, alice, bob };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite must run against the FHEVM mock network");
      this.skip();
    }

    ({ ballot, ballotAddress } = await deployFixture());
    totalQuestions = Number(await ballot.questionCount());
  });

  it("records encrypted responses and lets the submitter decrypt tallies", async function () {
    const answers = [0, 1, 2, 3, 1, 0];

    const input = fhevm.createEncryptedInput(ballotAddress, signers.alice.address);
    answers.forEach((value) => input.add32(value));
    const encrypted = await input.encrypt();

    const tx = await ballot.connect(signers.alice).submitResponses(
      [
        encrypted.handles[0],
        encrypted.handles[1],
        encrypted.handles[2],
        encrypted.handles[3],
        encrypted.handles[4],
        encrypted.handles[5],
      ],
      encrypted.inputProof,
    );
    await tx.wait();

    const [talliesQuestion0] = await ballot.getQuestionTallies(0);

    const clearSelected = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      talliesQuestion0[answers[0]],
      ballotAddress,
      signers.alice,
    );
    expect(clearSelected).to.eq(1);

    const clearOther = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      talliesQuestion0[(answers[0] + 1) % 4],
      ballotAddress,
      signers.alice,
    );
    expect(clearOther).to.eq(0);
  });

  it("prevents a respondent from submitting twice", async function () {
    const answers = [0, 0, 0, 0, 0, 0];
    const input = fhevm.createEncryptedInput(ballotAddress, signers.alice.address);
    answers.forEach((value) => input.add32(value));
    const encrypted = await input.encrypt();

    await ballot.connect(signers.alice).submitResponses(
      [
        encrypted.handles[0],
        encrypted.handles[1],
        encrypted.handles[2],
        encrypted.handles[3],
        encrypted.handles[4],
        encrypted.handles[5],
      ],
      encrypted.inputProof,
    );

    await expect(
      ballot.connect(signers.alice).submitResponses(
        [
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.handles[3],
          encrypted.handles[4],
          encrypted.handles[5],
        ],
        encrypted.inputProof,
      ),
    ).to.be.revertedWithCustomError(ballot, "AlreadyParticipated");
  });

  it("keeps results public after revealing and supports later submissions", async function () {
    await ballot.connect(signers.alice).requestPublicResults(1);
    const [, , isPublicBefore] = await ballot.getQuestionTallies(1);
    expect(isPublicBefore).to.eq(true);

    const bobAnswers = [2, 0, 1, 0, 0, 1];
    const input = fhevm.createEncryptedInput(ballotAddress, signers.bob.address);
    bobAnswers.forEach((value) => input.add32(value));
    const encrypted = await input.encrypt();

    await ballot.connect(signers.bob).submitResponses(
      [
        encrypted.handles[0],
        encrypted.handles[1],
        encrypted.handles[2],
        encrypted.handles[3],
        encrypted.handles[4],
        encrypted.handles[5],
      ],
      encrypted.inputProof,
    );

    const [talliesQuestion1, optionCount, isPublicAfter] = await ballot.getQuestionTallies(1);
    expect(optionCount).to.eq(3n);
    expect(isPublicAfter).to.eq(true);

    const decryptedTally = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      talliesQuestion1[bobAnswers[1]],
      ballotAddress,
      signers.bob,
    );
    expect(decryptedTally).to.eq(1);
  });

  it("reverts when requesting an invalid question", async function () {
    await expect(ballot.getQuestionTallies(totalQuestions)).to.be.revertedWithCustomError(
      ballot,
      "InvalidQuestion",
    );
    await expect(ballot.requestPublicResults(10)).to.be.revertedWithCustomError(ballot, "InvalidQuestion");
  });
});
