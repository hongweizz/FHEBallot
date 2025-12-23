import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="brand-mark">FHE</div>
          <div>
            <p className="header-eyebrow">Zama encrypted ballot</p>
            <h1 className="header-title">Confidential feedback for builders</h1>
            <p className="header-desc">
              Your choices never leave the browser unencrypted. Votes are tallied with Fully Homomorphic Encryption
              directly on Sepolia.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
