export const calculateMetrics = (answers) => {
  let efficiency = 50;
  let resilience = 50;
  let eq = 50;

  // Q1: Bonus reaction
  // 0: Invest (+Eff, -EQ), 1: Spend (+EQ, -Eff), 2: Save (+Res, -Eff)
  if (answers[0] === 0) { efficiency += 20; eq -= 10; }
  if (answers[0] === 1) { eq += 20; efficiency -= 20; }
  if (answers[0] === 2) { resilience += 20; efficiency -= 10; }

  // Q2: Subscription check
  // 0: Never check (-Eff), 1: Monthly (+Eff, +Res), 2: Daily (+EQ, +Eff)
  if (answers[1] === 0) { efficiency -= 20; }
  if (answers[1] === 1) { efficiency += 15; resilience += 10; }
  if (answers[1] === 2) { efficiency += 20; eq += 10; }

  // Q3: Car breakdown
  // 0: Credit card (-Res, -EQ), 1: Emergency fund (+Res, +Eff), 2: Borrow (-Res)
  if (answers[2] === 0) { resilience -= 30; eq -= 10; }
  if (answers[2] === 1) { resilience += 30; efficiency += 10; }
  if (answers[2] === 2) { resilience -= 20; }

  // Q4: Late night shopping
  // 0: Always (-EQ, -Eff), 1: Rarely (+EQ), 2: Never (+EQ, +Eff)
  if (answers[3] === 0) { eq -= 30; efficiency -= 20; }
  if (answers[3] === 1) { eq += 10; }
  if (answers[3] === 2) { eq += 20; efficiency += 10; }

  // Q5: Investment strategy
  // 0: All in crypto (-Res, -EQ), 1: Diversified (+Res, +Eff), 2: No investments (-Eff)
  if (answers[4] === 0) { resilience -= 20; eq -= 15; }
  if (answers[4] === 1) { resilience += 20; efficiency += 20; }
  if (answers[4] === 2) { efficiency -= 20; }

  const clamp = (val) => Math.max(0, Math.min(100, val));
  
  return {
    efficiency: clamp(efficiency),
    resilience: clamp(resilience),
    eq: clamp(eq)
  };
};

export const determineArchetype = (metrics) => {
  const { efficiency, resilience, eq } = metrics;
  
  if (eq < 40) return {
    id: 0,
    name: "The Impulse Liver",
    desc: "High emotion-driven spending, high weekend spikes, low efficiency.",
    nudge: "We noticed late-night spending is dragging down your Financial EQ. Take a pause tonight!"
  };
  
  if (resilience > 60 && efficiency < 50) return {
    id: 1,
    name: "The Anxious Planner",
    desc: "High savings rate, low discretionary spend, low spending efficiency score.",
    nudge: "Your Savings are great, but Spending Efficiency is low. It's okay to treat yourself today!"
  };
  
  if (resilience < 40 && efficiency > 60) return {
    id: 2,
    name: "The Blind Investor",
    desc: "High investment allocation, critical lack of cash buffer.",
    nudge: "Your Proactive Resilience is critically low. Consider keeping more cash on hand this week."
  };
  
  return {
    id: 3,
    name: "The Survivalist",
    desc: "Income tightly consumed by fixed costs, highly vulnerable to periodic spikes.",
    nudge: "No major spikes coming up soon. A perfect time to build a small buffer of $20."
  };
};

export const calculateLedgerMetrics = (income, transactions) => {
  let fixed = 0;
  let discretionary = 0;
  let savings = 0;
  let spikes = 0;

  transactions.forEach(t => {
    if (t.type === 'fixed') fixed += t.amount;
    if (t.type === 'discretionary') discretionary += t.amount;
    if (t.type === 'savings') savings += t.amount;
    if (t.type === 'spike') spikes += t.amount;
  });

  const clamp = (val) => Math.max(0, Math.min(100, Math.round(val)));

  // Spending Efficiency: 100 if you save everything, 0 if you spend > income
  let totalSpend = fixed + discretionary + spikes;
  let efficiencyRaw = 100 - ((totalSpend / income) * 100);
  if (savings > 0) efficiencyRaw += (savings / income) * 50;
  
  // Resilience: Driven heavily by savings vs spikes
  let resilienceRaw = 50; 
  if (savings > 0) resilienceRaw += (savings / income) * 100;
  if (spikes > 0) resilienceRaw -= (spikes / income) * 100;
  if (fixed > income * 0.7) resilienceRaw -= 30; // High fixed costs crush resilience
  
  // Financial EQ: Driven by discretionary vs savings control
  let eqRaw = 70;
  if (discretionary > 0) eqRaw -= (discretionary / income) * 100;
  if (savings > discretionary) eqRaw += 20;

  return {
    efficiency: clamp(efficiencyRaw),
    resilience: clamp(resilienceRaw),
    eq: clamp(eqRaw)
  };
};
