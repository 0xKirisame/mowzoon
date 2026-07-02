import { useState, useEffect } from 'react';
import { calculateMetrics, determineArchetype, calculateLedgerMetrics } from './scoring';
import './index.css';

const QUESTIONS = [
  {
    text: "You suddenly receive a $5,000 bonus. What is your immediate reaction?",
    options: [
      "Put it directly into an index fund.",
      "Book a spontaneous weekend trip.",
      "Keep it in checking 'just in case'."
    ]
  },
  {
    text: "How often do you review your active subscriptions?",
    options: [
      "Never, I just let them auto-renew.",
      "Maybe once a month or when I notice a charge.",
      "I track them meticulously in a spreadsheet."
    ]
  },
  {
    text: "Your car breaks down and needs a $1,000 repair tomorrow. How do you pay for it?",
    options: [
      "Put it on a credit card and figure it out later.",
      "Pull it from my dedicated emergency fund.",
      "Borrow from family or friends."
    ]
  },
  {
    text: "How often do you find yourself shopping online after 10 PM?",
    options: [
      "Almost every week. It's how I unwind.",
      "Rarely, only if there's a big sale.",
      "Never. I don't buy things on impulse."
    ]
  },
  {
    text: "Which best describes your investment strategy?",
    options: [
      "All in on crypto and highly speculative stocks.",
      "A diversified portfolio of ETFs and bonds.",
      "I don't invest. I keep everything in cash."
    ]
  }
];

const MOCK_FRIENDS = [
  {
    name: "Sarah J.",
    archetype: "The Impulse Liver",
    tip: "Sarah thrives on spontaneous plans. Suggest free or low-cost activities like hiking or beach days to help her protect her EQ score without feeling restricted."
  },
  {
    name: "David M.",
    archetype: "The Anxious Planner",
    tip: "David over-saves and rarely enjoys his money. Buy him a coffee or force him out for a nice dinner—he has the efficiency score to handle it!"
  },
  {
    name: "Aisha T.",
    archetype: "The Survivalist",
    tip: "Aisha is tightly managing fixed costs right now. Avoid suggesting expensive group trips. Host game nights or potlucks to keep her included guilt-free."
  }
];

function App() {
  const [mode, setMode] = useState('survey'); // 'survey' | 'simulator'
  
  // Survey State
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);

  // Ledger Simulator State
  const [income, setIncome] = useState(5000);
  const [transactions, setTransactions] = useState([]);
  const [simMetrics, setSimMetrics] = useState({ efficiency: 100, resilience: 50, eq: 70 });
  const [simArchetype, setSimArchetype] = useState(determineArchetype({ efficiency: 100, resilience: 50, eq: 70 }));

  useEffect(() => {
    const metrics = calculateLedgerMetrics(income, transactions);
    setSimMetrics(metrics);
    setSimArchetype(determineArchetype(metrics));
  }, [income, transactions]);

  const handleOptionClick = (optionIndex) => {
    const newAnswers = [...answers, optionIndex];
    
    if (newAnswers.length === QUESTIONS.length) {
      const metrics = calculateMetrics(newAnswers);
      const archetype = determineArchetype(metrics);
      setResult({ metrics, archetype });
    } else {
      setAnswers(newAnswers);
      setCurrentQuestion(curr => curr + 1);
    }
  };

  const resetSurvey = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setResult(null);
  };

  const addTransaction = (desc, type, amount) => {
    setTransactions([{ desc, type, amount, id: Date.now() }, ...transactions]);
  };

  const renderSimulator = () => {
    const totalSpent = transactions.reduce((acc, t) => acc + (t.type !== 'savings' ? t.amount : 0), 0);
    const totalSaved = transactions.reduce((acc, t) => acc + (t.type === 'savings' ? t.amount : 0), 0);

    return (
      <div className="app-container" style={{maxWidth: '800px'}}>
        <div className="glass-panel">
          <div className="header-flex">
            <h1>Transaction Simulator</h1>
            <button className="toggle-btn" onClick={() => setMode('survey')}>Back to Survey</button>
          </div>
          <p className="subtitle">Simulate real-world spending to see how the XGBoost Model classifies you.</p>

          <div className="simulator-grid">
            {/* Left Column: Ledger Input */}
            <div className="ledger-input-panel">
              <div className="income-input">
                <label>Monthly Income ($)</label>
                <input 
                  type="number" 
                  value={income} 
                  onChange={(e) => setIncome(Number(e.target.value))}
                  className="glass-input"
                />
              </div>

              <h3 className="section-heading">Quick Add Transactions</h3>
              <div className="tx-buttons">
                <button onClick={() => addTransaction("🏠 Pay Rent", "fixed", 1500)} className="tx-btn fixed-btn">Rent ($1,500)</button>
                <button onClick={() => addTransaction("🎮 Buy Videogame", "discretionary", 60)} className="tx-btn disc-btn">Videogame ($60)</button>
                <button onClick={() => addTransaction("🍔 Late Night Food", "discretionary", 30)} className="tx-btn disc-btn">Late Food ($30)</button>
                <button onClick={() => addTransaction("📈 Invest in S&P500", "savings", 500)} className="tx-btn save-btn">Invest ($500)</button>
                <button onClick={() => addTransaction("🚗 Buy Car (Cash)", "spike", 3000)} className="tx-btn spike-btn">Buy Car ($3,000)</button>
                <button onClick={() => addTransaction("💍 Wedding Expense", "spike", 5000)} className="tx-btn spike-btn">Marriage ($5,000)</button>
              </div>

              <h3 className="section-heading">Ledger Feed</h3>
              <div className="ledger-feed">
                {transactions.length === 0 ? <div className="empty-ledger">No transactions yet.</div> : null}
                {transactions.map(t => (
                  <div key={t.id} className="ledger-item">
                    <span>{t.desc}</span>
                    <span className={`tx-amount ${t.type}`}>${t.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Model Output */}
            <div className="model-output-panel">
              <div className="balance-sheet">
                <div>Spent: <span style={{color: '#ff7b72'}}>${totalSpent}</span></div>
                <div>Saved: <span style={{color: '#3fb950'}}>${totalSaved}</span></div>
                <div>Remaining: <span>${income - totalSpent - totalSaved}</span></div>
              </div>

              <div className="archetype-card live-preview" style={{marginTop: '1rem'}}>
                <div className="live-badge">Live Classification</div>
                <h2 className="archetype-title" style={{fontSize: '2rem'}}>{simArchetype.name}</h2>
              </div>

              <div className="metrics-container" style={{marginTop: '1.5rem'}}>
                <div className="metric-row">
                  <div className="metric-label">
                    <span>Spending Efficiency</span>
                    <span>{simMetrics.efficiency}/100</span>
                  </div>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ width: `${simMetrics.efficiency}%` }}></div>
                  </div>
                </div>
                
                <div className="metric-row">
                  <div className="metric-label">
                    <span>Proactive Resilience</span>
                    <span>{simMetrics.resilience}/100</span>
                  </div>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ width: `${simMetrics.resilience}%` }}></div>
                  </div>
                </div>
                
                <div className="metric-row">
                  <div className="metric-label">
                    <span>Financial EQ</span>
                    <span>{simMetrics.eq}/100</span>
                  </div>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ width: `${simMetrics.eq}%` }}></div>
                  </div>
                </div>
              </div>

              <button className="reset-btn" onClick={() => setTransactions([])} style={{marginTop: '1rem'}}>Clear Ledger</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (mode === 'simulator') {
    return renderSimulator();
  }

  if (result) {
    const { metrics, archetype } = result;
    return (
      <div className="app-container">
        <div className="glass-panel">
          <div className="header-flex">
             <h1>Analysis Complete</h1>
             <button className="toggle-btn" onClick={() => setMode('simulator')}>Open Simulator</button>
          </div>
          <p className="subtitle">Your financial DNA has been decoded.</p>
          
          <div className="archetype-card">
            <h2 className="archetype-title">{archetype.name}</h2>
            <p className="archetype-desc">{archetype.desc}</p>
          </div>

          <div className="metrics-container">
            <div className="metric-row">
              <div className="metric-label">
                <span>Spending Efficiency</span>
                <span>{metrics.efficiency}/100</span>
              </div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: `${metrics.efficiency}%` }}></div>
              </div>
            </div>
            
            <div className="metric-row">
              <div className="metric-label">
                <span>Proactive Resilience</span>
                <span>{metrics.resilience}/100</span>
              </div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: `${metrics.resilience}%` }}></div>
              </div>
            </div>
            
            <div className="metric-row">
              <div className="metric-label">
                <span>Financial EQ</span>
                <span>{metrics.eq}/100</span>
              </div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: `${metrics.eq}%` }}></div>
              </div>
            </div>
          </div>

          <div className="nudge-box">
            <strong>Today's Micro-Nudge:</strong><br/><br/>
            {archetype.nudge}
          </div>

          <div className="friends-section">
            <h3 className="friends-header">Your Circle (Family & Friends)</h3>
            <p className="friends-subtitle">See how your network scores and tips for interacting with them.</p>
            <div className="friends-grid">
              {MOCK_FRIENDS.map((friend, idx) => (
                <div key={idx} className="friend-card">
                  <div className="friend-header">
                    <div className="friend-avatar">{friend.name.charAt(0)}</div>
                    <div>
                      <h4 className="friend-name">{friend.name}</h4>
                      <span className="friend-archetype">{friend.archetype}</span>
                    </div>
                  </div>
                  <div className="friend-tip">
                    <strong>Coaching Tip: </strong>{friend.tip}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="reset-btn" onClick={resetSurvey}>Retake Assessment</button>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion) / QUESTIONS.length) * 100;

  return (
    <div className="app-container">
      <div className="glass-panel">
        <div className="header-flex">
          <h1>Mowzoon</h1>
          <button className="toggle-btn" onClick={() => setMode('simulator')}>Open Simulator</button>
        </div>
        <p className="subtitle">Financial Psychology Assessment</p>
        
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="question-text">
          {QUESTIONS[currentQuestion].text}
        </div>

        <div className="options-container">
          {QUESTIONS[currentQuestion].options.map((opt, idx) => (
            <button 
              key={idx} 
              className="option-btn"
              onClick={() => handleOptionClick(idx)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
