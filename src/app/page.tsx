type CommitmentStatus = "Ready" | "Blocked" | "Completed";

type Commitment = {
  id: string;
  title: string;
  category: string;
  dueDate: string;
  status: CommitmentStatus;
  nextAction: string;
};

const sampleCommitments: Commitment[] = [
  {
    id: "1",
    title: "Renew vehicle insurance",
    category: "Insurance",
    dueDate: "Dec 15, 2026",
    status: "Ready",
    nextAction: "Review the existing policy",
  },
  {
    id: "2",
    title: "Renew rental agreement",
    category: "Home",
    dueDate: "Nov 20, 2026",
    status: "Blocked",
    nextAction: "Waiting for the updated rental terms",
  },
  {
    id: "3",
    title: "Complete certification renewal",
    category: "Career",
    dueDate: "Nov 05, 2026",
    status: "Completed",
    nextAction: "Completion recorded",
  },
];

function StatusBadge({status}: {status: CommitmentStatus}) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {status}
    </span>
  );
}

export default function HomePage() {
  const activeCommitments = sampleCommitments.filter(
    (item) => item.status !== "Completed",
  );
  const blockedCount = sampleCommitments.filter(
    (item) => item.status === "Blocked",
  ).length;
  const completedCount = sampleCommitments.filter(
    (item) => item.status === "Completed",
  ).length;
  return(
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">L</span>
          <span>LifeFlow</span>
        </a>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="navigation" aria-label="Main navigation">
          <a className="nav-link active" href="#overview">
            <span aria-hidden="true">◫</span>
            Overview
          </a>
          <a className="nav-link" href="#commitments">
            <span aria-hidden="true">◷</span>
            Commitments
          </a>
          <a className="nav-link" href="#next-action">
            <span aria-hidden="true">↗</span>
            Next actions
          </a>
        </nav>
        <div className="privacy-note">
          <span aria-hidden="true">⌑</span>
          <div>
            <strong>Privacy first</strong>
            <p>Private documents will be encrypted on yor device.</p>
          </div>
        </div>
      </aside>
      <section className="main-content" id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>
            <h1>Get important things done.</h1>
          </div>
          <span className="avatar" aria-label="Demo profile">
            D
          </span>
        </header>
        <section className="intro">
          <p className="eyebrow">LESS CHASING. MORE COMPLETING.</p>
          <h2>Know what matters. Know what comes next.</h2>
          <p>
            LifeFlow helps you manage important responsibilities,
            understand what is blocking progress, and keep the
            information you need to finish the job. 
          </p>
        </section>
        <section className="stats-grid" aria-label="Commitment summary">
          <article className="stat-card">
            <p>Active commitments</p>
            <strong>{activeCommitments.length}</strong>
            <span>Still need attention</span>
          </article>
          <article className="stat-card">
            <p>Blocked commitments</p>
            <strong>{blockedCount}</strong>
            <span>Need a prerequisite</span>
          </article>
          <article className="stat-card">
            <p>Completed</p>
            <strong>{completedCount}</strong>
            <span>Recorded in this demo</span>
          </article>
        </section>
        <section className="next-action" id="next-action">
          <div>
            <p className="eyebrow">A GOOD PLACE TO START</p>
            <h2>Review your vehicle insurance policy</h2>
            <p>
              This is a sample recommendation. The finished product
              will prioritize actions using deadlines, prerequisites,
              and their impact on other commitments.
            </p>
          </div>
          <span className="action-symbol" aria-hidden="true">
            →
          </span>
        </section>
        <section className="commitments-section" id="commitments">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR RESPONSIBILITIES</p>
              <h2>Commitments</h2>
            </div>
            <span className="sample-label">Sample data</span>
          </div>
          <div className="commitment-list">
            {
              sampleCommitments.map((commitment) => (
                <article
                  className="commitment-card"
                  key={commitment.id}
                >
                  <div className="commitment-main">
                    <div className="commitment-icon" aria-hidden="true">
                      {
                        commitment.category === "Insurance"
                          ? "▤"
                          : commitment.category === "Home"
                            ? "⌂"
                            : "◇"
                      }
                    </div>
                    <div className="commitment-details">
                      <h3>{commitment.title}</h3>
                      <p>{commitment.category}</p>
                      <p className="next-step">
                        {commitment.nextAction}
                      </p>
                    </div>
                  </div>
                  <div className="commitment-meta">
                    <span className="due-date">
                      {commitment.dueDate}
                    </span>
                    <StatusBadge status={commitment.status}/>
                  </div>
                </article>
              ))
            }
          </div>
        </section>
        <footer className="page-footer">
          LifeFlow · Built around real-world responsibilities
        </footer>
      </section>
    </main>
  );
}