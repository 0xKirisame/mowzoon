// Five questions, four voices each - every option is a person you might
// be, not just an intensity dial. Options carry weights on the three
// metrics (e = spending efficiency, r = proactive resilience, q =
// financial EQ); scores start at 50. Arabic mirror lives in SURVEY_AR
// (i18n.jsx) and must stay index-aligned with this file.
// Classification itself is determineArchetype() in scoring.js.

export const SURVEY = [
  {
    category: 'Instincts',
    text: 'A SAR 5,000 bonus lands tonight. Where is it a week later?',
    options: [
      { label: 'Mostly invested - I moved it before the weekend.', e: 8, r: -6, q: 1 },
      { label: 'Mostly gone - a trip, gifts, a few great nights out.', e: -7, r: -4, q: -8 },
      { label: 'Still sitting in checking, untouched. Just in case.', e: -3, r: 9, q: 2 },
      { label: 'Split on purpose: some saved, some enjoyed, no guilt.', e: 7, r: 5, q: 6 },
    ],
  },
  {
    category: 'Resilience',
    text: 'Your car needs a SAR 1,200 repair by tomorrow morning. How does it actually get paid?',
    options: [
      { label: 'My emergency fund - it exists for exactly this.', r: 12, e: 3, q: 2 },
      { label: 'Credit card now; next month can worry about it.', r: -10, q: -5 },
      { label: "I'd have to borrow from family or a friend.", r: -8, e: -2, q: -2 },
      { label: 'Cash covers it, but the rest of the month gets very tight.', r: 2, e: 1 },
    ],
  },
  {
    category: 'Awareness',
    text: "Without opening your bank app: how close could you guess what you've spent this month?",
    options: [
      { label: 'Within about SAR 100 - I know my number.', e: 10, q: 5, r: 2 },
      { label: 'Within a few hundred, give or take.', e: 4, q: 2 },
      { label: "Honestly, I'd be off by a lot.", e: -8, q: -3 },
      { label: 'I avoid looking. The number stresses me out.', e: -5, q: -6, r: -2 },
    ],
  },
  {
    category: 'Impulse',
    text: "It's past midnight, you can't sleep, and something is sitting in your cart. What usually happens?",
    options: [
      { label: 'Checked out before I can talk myself out of it.', q: -12, e: -6 },
      { label: 'I sleep on it - most carts are dead by morning.', q: 9, e: 4 },
      { label: 'Depends on the month. Payday-me is dangerous.', q: -3, e: -1 },
      { label: "There's never anything in my cart. Wanting isn't buying.", q: 10, e: 3, r: 2 },
    ],
  },
  {
    category: 'Strategy',
    text: 'Which sentence sounds most like your money right now?',
    options: [
      { label: 'Big bets, thin savings - but think of the upside.', e: 5, r: -11, q: -4 },
      { label: 'Every riyal has a job: categories, limits, reviews.', e: 11, r: 4, q: 3 },
      { label: 'Fixed costs eat almost everything; I survive the month.', e: -4, r: -7, q: 1 },
      { label: 'I save hard, but never let myself enjoy any of it.', e: -6, r: 9, q: -3 },
    ],
  },
];

export function scoreSurvey(answers) {
  let e = 50, r = 50, q = 50;
  answers.forEach((ai, i) => {
    const o = SURVEY[i].options[ai];
    e += o.e || 0;
    r += o.r || 0;
    q += o.q || 0;
  });
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  return { efficiency: clamp(e), resilience: clamp(r), eq: clamp(q) };
}
