import { useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Contract } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';

import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { questions } from '../config/questions';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/Survey.css';
import { Header } from './Header';

// const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function SurveyApp() {
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner();
  const { instance, isLoading: encryptionLoading, error: encryptionError } = useZamaInstance();

  const [answers, setAnswers] = useState<number[]>(() => Array(questions.length).fill(-1));
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decryptedTallies, setDecryptedTallies] = useState<Record<number, number[]>>({});

  const contractReady = true;

  const { data: hasSubmitted } = useReadContract({
    address: contractReady ? CONTRACT_ADDRESS : undefined,
    abi: CONTRACT_ABI,
    functionName: 'hasSubmitted',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contractReady,
    },
  });

  const {
    data: talliesData,
    refetch: refetchTallies,
    isFetching: loadingTallies,
  } = useReadContract({
    address: contractReady ? CONTRACT_ADDRESS : undefined,
    abi: CONTRACT_ABI,
    functionName: 'getQuestionTallies',
    args: [BigInt(activeQuestion)],
    query: {
      enabled: contractReady,
    },
  });

  const optionCount = useMemo(() => Number(talliesData?.[1] ?? 0n), [talliesData]);
  const handles = useMemo(
    () => (talliesData?.[0] ?? []).slice(0, optionCount) as readonly string[],
    [talliesData, optionCount]
  );
  const isPublic = Boolean(talliesData?.[2]);

  const onSelectAnswer = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => prev.map((value, idx) => (idx === questionIndex ? optionIndex : value)));
  };

  const submitSurvey = async () => {
    if (!contractReady) {
      setActionError('Set a deployed ballot address before submitting.');
      return;
    }
    if (!isConnected || !address) {
      setActionError('Connect your wallet to submit encrypted answers.');
      return;
    }
    if (!instance || encryptionLoading) {
      setActionError('Encryption service is not ready yet.');
      return;
    }
    if (answers.some((answer) => answer < 0)) {
      setActionError('Please answer every question.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setActionError('No signer available from your wallet.');
      return;
    }

    try {
      setSubmitting(true);
      setActionError(null);
      setInfoMessage('Encrypting your responses...');

      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      answers.forEach((value) => buffer.add32(value));
      const encrypted = await buffer.encrypt();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.submitResponses(
        [
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.handles[3],
          encrypted.handles[4],
          encrypted.handles[5],
        ],
        encrypted.inputProof
      );

      setInfoMessage('Waiting for confirmation...');
      await tx.wait();
      setInfoMessage('Responses submitted and kept private with FHE.');
      await refetchTallies();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit survey';
      setActionError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const requestPublicResults = async () => {
    if (!contractReady) {
      setActionError('Set the ballot address before revealing results.');
      return;
    }
    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setActionError('Connect your wallet to request public results.');
      return;
    }

    try {
      setActionError(null);
      setInfoMessage('Requesting public decryption from the contract...');
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.requestPublicResults(activeQuestion);
      await tx.wait();
      setInfoMessage('This question is now publicly decryptable.');
      await refetchTallies();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to request public results';
      setActionError(message);
    }
  };

  const decryptTalliesForQuestion = async () => {
    if (!instance || handles.length === 0) {
      setActionError('Nothing to decrypt yet.');
      return;
    }
    if (!isPublic && (!isConnected || !address)) {
      setActionError('Connect your wallet or request public results first.');
      return;
    }

    try {
      setDecrypting(true);
      setActionError(null);
      setInfoMessage(isPublic ? 'Requesting public decryption...' : 'Requesting user-scoped decryption...');

      if (isPublic) {
        const result = await instance.publicDecrypt(handles);
        const clearValues = handles.map((handle) => Number(result.clearValues?.[handle] ?? 0));
        setDecryptedTallies((prev) => ({ ...prev, [activeQuestion]: clearValues }));
      } else {
        const keypair = instance.generateKeypair();
        const contractAddresses = [CONTRACT_ADDRESS];
        const startTimeStamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = '10';
        const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

        const resolvedSigner = await signer;
        if (!resolvedSigner) {
          throw new Error('No signer available.');
        }

        const signature = await resolvedSigner.signTypedData(
          eip712.domain,
          {
            UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
          },
          eip712.message
        );

        const handleContractPairs = handles.map((handle) => ({
          handle,
          contractAddress: CONTRACT_ADDRESS,
        }));

        const result = await instance.userDecrypt(
          handleContractPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''),
          contractAddresses,
          address,
          startTimeStamp,
          durationDays
        );

        const clearValues = handles.map((handle) => Number(result[handle] ?? 0));
        setDecryptedTallies((prev) => ({ ...prev, [activeQuestion]: clearValues }));
      }
      setInfoMessage('Tallies decrypted.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Decryption failed';
      setActionError(message);
    } finally {
      setDecrypting(false);
    }
  };

  const selectedTallies = decryptedTallies[activeQuestion];

  return (
    <div className="survey-page">
      <Header />
      <main className="survey-shell">
        <div className="toolbar">
          <div className="pill">Encrypted survey · 6 questions</div>
          <div className="toolbar-actions">
            <ConnectButton />
          </div>
        </div>

        <div className="survey-grid">
          <section className="card form-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Submit privately</p>
                <h2 className="card-title">Share your Zama experience</h2>
                <p className="card-subtitle">
                  Each choice is encrypted in your browser and tallied on-chain with FHE. Only one submission per
                  wallet.
                </p>
              </div>
              <div className="status-stack">
                <span className={`status-dot ${contractReady ? 'ok' : 'warn'}`} />
                <span className="status-label">
                  {contractReady ? 'Ballot contract ready' : 'Set Sepolia contract address'}
                </span>
                <span className={`status-dot ${hasSubmitted ? 'warn' : 'ok'}`} />
                <span className="status-label">{hasSubmitted ? 'Already submitted' : 'Not submitted'}</span>
                <span className={`status-dot ${instance && !encryptionLoading ? 'ok' : 'warn'}`} />
                <span className="status-label">
                  {instance && !encryptionLoading ? 'Encryption live' : 'Loading relayer'}
                </span>
              </div>
            </div>

            <div className="question-stack">
              {questions.map((question, index) => (
                <div key={question.id} className="question-card">
                  <div className="question-head">
                    <div className="question-index">{index + 1}</div>
                    <div>
                      <p className="question-title">{question.title}</p>
                      <p className="question-subtitle">{question.subtitle}</p>
                    </div>
                  </div>
                  <div className="options-grid">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[index] === optionIndex;
                      return (
                        <label
                          key={option}
                          className={`option-tile ${selected ? 'selected' : ''}`}
                          onClick={() => onSelectAnswer(index, optionIndex)}
                        >
                          <input
                            type="radio"
                            name={`question-${index}`}
                            checked={selected}
                            onChange={() => onSelectAnswer(index, optionIndex)}
                          />
                          <span className="option-index">{optionIndex + 1}</span>
                          <span className="option-label">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                onClick={submitSurvey}
                disabled={submitting || !!hasSubmitted || !contractReady}
              >
                {submitting ? 'Sending encrypted answers...' : hasSubmitted ? 'Already submitted' : 'Submit answers'}
              </button>
              {actionError ? <span className="error-text">{actionError}</span> : null}
              {infoMessage ? <span className="info-text">{infoMessage}</span> : null}
              {encryptionError ? <span className="error-text">{encryptionError}</span> : null}
            </div>
          </section>

          <section className="card results-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Live tallies</p>
                <h2 className="card-title">Question insights</h2>
              </div>
              <div className="question-selector">
                <label htmlFor="question-select">Question</label>
                <select
                  id="question-select"
                  value={activeQuestion}
                  onChange={(event) => {
                    setActiveQuestion(Number(event.target.value));
                    setInfoMessage(null);
                    setActionError(null);
                  }}
                >
                  {questions.map((question, index) => (
                    <option key={question.id} value={index}>
                      {index + 1}. {question.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="result-meta">
              <div className={`badge ${isPublic ? 'badge-open' : 'badge-locked'}`}>
                {isPublic ? 'Publicly decryptable' : 'Encrypted — submit or reveal to decrypt'}
              </div>
              <div className="small-text">
                {loadingTallies
                  ? 'Fetching encrypted tallies...'
                  : `Options tracked: ${optionCount || questions[activeQuestion].options.length}`}
              </div>
            </div>

            <div className="result-grid">
              {questions[activeQuestion].options.map((option, optionIndex) => {
                const decrypted = selectedTallies?.[optionIndex];
                const hasValue = decrypted !== undefined;
                return (
                  <div key={option} className="result-card">
                    <div className="result-option">
                      <span className="option-index">{optionIndex + 1}</span>
                      <span className="option-label">{option}</span>
                    </div>
                    <div className="result-value">
                      {hasValue ? decrypted : '•••'}
                      <span className="result-caption">{hasValue ? 'votes' : 'encrypted'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="action-row results-actions">
              <button
                className="ghost-button"
                onClick={decryptTalliesForQuestion}
                disabled={decrypting || loadingTallies || handles.length === 0 || !contractReady}
              >
                {decrypting ? 'Decrypting...' : 'Decrypt tallies'}
              </button>
              <button
                className="secondary-button"
                onClick={requestPublicResults}
                disabled={loadingTallies || isPublic || !contractReady}
              >
                {isPublic ? 'Already public' : 'Make results public'}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
