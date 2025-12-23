import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:ballot-address", "Prints the FHEBallot address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const ballot = await deployments.get("FHEBallot");

  console.log("FHEBallot address is " + ballot.address);
});

task("task:submit-survey", "Submit encrypted answers to the ballot")
  .addOptionalParam("address", "Optionally specify the FHEBallot contract address")
  .addParam("answers", "Comma separated numeric answers for the 6 questions")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const answers = (taskArguments.answers as string)
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => parseInt(value, 10));

    if (answers.length !== 6) {
      throw new Error("Expected 6 answers matching the questionnaire");
    }

    const ballotDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHEBallot");

    const signers = await ethers.getSigners();
    const ballot = await ethers.getContractAt("FHEBallot", ballotDeployment.address);

    const encryptedInput = fhevm.createEncryptedInput(ballotDeployment.address, signers[0].address);
    answers.forEach((value) => encryptedInput.add32(value));
    const encrypted = await encryptedInput.encrypt();

    const tx = await ballot.connect(signers[0]).submitResponses(
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
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:decrypt-question", "Decrypt tallies for a specific question")
  .addParam("question", "Question id between 0 and 5")
  .addOptionalParam("address", "Optionally specify the FHEBallot contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const question = parseInt(taskArguments.question, 10);
    const ballotDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHEBallot");

    const signers = await ethers.getSigners();
    const ballot = await ethers.getContractAt("FHEBallot", ballotDeployment.address);

    const [tallies, optionCount, isPublic] = await ballot.getQuestionTallies(question);
    console.log(`FHEBallot: ${ballotDeployment.address} question=${question} public=${isPublic}`);

    for (let i = 0; i < Number(optionCount); i++) {
      const clearValue = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        tallies[i],
        ballotDeployment.address,
        signers[0],
      );
      console.log(`Option ${i}: ${clearValue.toString()}`);
    }
  });

task("task:reveal-question", "Make a question's tallies publicly decryptable")
  .addParam("question", "Question id between 0 and 5")
  .addOptionalParam("address", "Optionally specify the FHEBallot contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const question = parseInt(taskArguments.question, 10);
    const ballotDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHEBallot");

    const signers = await ethers.getSigners();
    const ballot = await ethers.getContractAt("FHEBallot", ballotDeployment.address);

    const tx = await ballot.connect(signers[0]).requestPublicResults(question);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });
