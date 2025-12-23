import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedBallot = await deploy("FHEBallot", {
    from: deployer,
    log: true,
  });

  console.log(`FHEBallot contract: `, deployedBallot.address);
};
export default func;
func.id = "deploy_fheBallot"; // id required to prevent reexecution
func.tags = ["FHEBallot"];
