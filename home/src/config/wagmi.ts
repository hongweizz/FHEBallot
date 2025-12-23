import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Zama FHE Ballot',
  projectId: 'b60f1060da9f3c40819274f1f10cece3', // Public WalletConnect demo id
  chains: [sepolia],
  ssr: false,
});
