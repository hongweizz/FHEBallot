type SurveyQuestion = {
  id: number;
  title: string;
  subtitle: string;
  options: string[];
};

export const questions: SurveyQuestion[] = [
  {
    id: 1,
    title: 'Which FHEVM capability do you want to ship first?',
    subtitle: 'Pick the encrypted workflow that matters most to your roadmap.',
    options: [
      'Private governance or DAO voting',
      'Encrypted on-chain analytics',
      'Confidential identity checks without document uploads',
      'Composable encrypted application state'
    ],
  },
  {
    id: 2,
    title: 'How familiar are you with the Relayer SDK?',
    subtitle: 'We rely on it for encryption, ACL, and public decrypt flows.',
    options: ['Using it in production builds', 'Trying it in sandboxes', 'Reading docs but not integrated'],
  },
  {
    id: 3,
    title: 'What tooling do you pair with FHEVM?',
    subtitle: 'Helps us focus examples on the stacks you already trust.',
    options: ['Hardhat with TypeChain', 'Foundry/Anvil', 'Custom node tooling'],
  },
  {
    id: 4,
    title: 'What slows you down today?',
    subtitle: 'Select the blocker you most want us to improve.',
    options: ['Gas and performance costs', 'More examples and docs', 'SDK stability', 'Testnet reliability'],
  },
  {
    id: 5,
    title: 'When do you expect to ship an FHE feature?',
    subtitle: 'Rough timing helps us prioritize support and guides.',
    options: ['This quarter', 'Within two quarters', 'Just experimenting for now'],
  },
  {
    id: 6,
    title: 'Preferred frontend stack for FHE apps?',
    subtitle: 'Tell us how you wire in encryption on the client.',
    options: ['Viem + React', 'Ethers with a custom relayer client', 'Other frameworks or languages'],
  },
];
