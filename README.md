# FHEBallot

FHEBallot is an encrypted, six-question survey built on Zama FHEVM. Each user answer is encrypted in the browser, aggregated on-chain in encrypted form, and only a single question's results can be selectively made public by request. This preserves privacy for individual respondents while still enabling verifiable, public aggregation.

## Why this project exists

Traditional surveys leak sensitive preferences because responses are stored in plaintext or trust a central server. FHEBallot removes that trust assumption by keeping responses encrypted end-to-end and only revealing aggregated counts on demand.

## Problems it solves

- Protects individual answers from being visible to anyone, including the contract owner and backend relayers.
- Prevents targeted data leakage by only allowing per-question public decryption.
- Provides verifiable, on-chain aggregation without giving up privacy.
- Enables public auditability of results without exposing raw votes.

## Key advantages

- End-to-end encryption using Zama FHEVM, with encrypted tallies stored on-chain.
- Granular disclosure: only the requested question becomes public, others remain private.
- Client-side encryption, no plaintext answers leave the user device.
- Transparent and reproducible on-chain aggregation.
- Separation of concerns between encrypted write operations and public read operations.

## Technical stack

- Contracts: Hardhat + Zama FHEVM contracts
- Frontend: React + Vite + viem (reads) + ethers (writes) + RainbowKit wallet UX
- Encryption/relaying: `@zama-fhe/relayer-sdk` via the frontend Zama instance
- Package manager: npm

## What the app does

The survey contains six questions about Zama, each with 2-4 possible choices.

1. The user selects one answer per question.
2. The frontend encrypts each answer with FHE keys and submits encrypted choices on-chain.
3. The contract increments encrypted counters for each choice.
4. A user can request results for a single question, which turns that question's encrypted counts into public decryptable values.

## Data flow (end-to-end)

1. Wallet connects (RainbowKit).
2. Frontend obtains encryption context via the Zama relayer SDK.
3. Answers are encrypted on the client.
4. Encrypted payload is submitted to the contract using ethers write flows.
5. Encrypted tallies are stored per question and choice.
6. A request for public results triggers per-question public decryption.
7. Read-only views use viem to fetch decrypted tallies.

## Repository structure

- `contracts/`: FHEBallot contract and Zama-related contract logic
- `deploy/`: deployment scripts
- `deployments/`: generated deployment metadata and ABI (source of truth for frontend ABI)
- `tasks/`: Hardhat tasks for common flows
- `test/`: automated tests (mock network)
- `home/`: React frontend (this is the only UI entry point)
- `docs/`: Zama docs referenced by the project

## Prerequisites

- Node.js 20+
- npm
- Environment variables in `.env` for contract deployment:
  - `PRIVATE_KEY` (hex without `0x`)
  - `INFURA_API_KEY`
  - `ETHERSCAN_API_KEY` (optional, for verification)

## Smart contracts (local dev + test)

1. Install dependencies (keeps the existing lockfile untouched):
   ```bash
   npm install --no-package-lock
   ```
2. Compile and generate types:
   ```bash
   npm run compile
   ```
3. Run the mock-network tests:
   ```bash
   npm test
   ```

## Deployments

1. Deploy to a local FHEVM-compatible node (for contract dev only):
   ```bash
   npx hardhat deploy --network hardhat
   ```
2. Deploy to Sepolia (uses PRIVATE_KEY + INFURA_API_KEY):
   ```bash
   npm run deploy:sepolia
   ```
3. Copy the ABI from `deployments/sepolia/FHEBallot.json` into the frontend ABI source and update the address in `home/src/config/contracts.ts`.

### Hardhat tasks

- Print address: `npx hardhat task:ballot-address`
- Submit answers: `npx hardhat task:submit-survey --answers "0,1,2,0,1,0"`
- Decrypt tallies: `npx hardhat task:decrypt-question --question 0`
- Reveal results: `npx hardhat task:reveal-question --question 1`

## Frontend (home/)

- Install UI deps: `cd home && npm install --no-package-lock`
- Set the contract address in `home/src/config/contracts.ts`
- Ensure the ABI matches `deployments/sepolia/FHEBallot.json`
- Run the app: `npm run dev`

### Frontend implementation rules

- Contract reads use viem (`useReadContract`), writes use ethers (`useEthersSigner`).
- No frontend environment variables; configuration is checked into `home/src/config/`.
- No localstorage usage for survey state or encryption data.
- No Tailwind in the frontend.
- The frontend targets Sepolia for production; localhost networks are not supported in UI.

## Security and privacy considerations

- Individual answers never appear on-chain or in logs in plaintext.
- The contract never relies on `msg.sender` in view functions, preventing hidden caller assumptions.
- Only per-question public decryption is supported; all other questions remain encrypted.
- The deployment flow forbids MNEMONIC usage; only `PRIVATE_KEY` is accepted.

## Current limitations

- Only six questions are supported in the current UI.
- Each question has a fixed, small set of choices (2-4).
- Public decryption is per-question, not per-choice or global.
- No administrative dashboard; all actions are via tasks or the frontend.

## Future roadmap

- Configurable surveys (question count and choice count) without redeploying the frontend.
- Admin controls for survey lifecycle (open, close, finalize).
- Improved on-chain event indexing for analytics dashboards.
- More granular result disclosure and audit tooling.
- Broader wallet support and accessibility improvements in the UI.
- Optimized gas usage with batched encryption payloads.

## Notes

- Frontend ABI must come from the deployed contract artifacts in `deployments/sepolia`.
- Do not use MNEMONIC for deployment.
