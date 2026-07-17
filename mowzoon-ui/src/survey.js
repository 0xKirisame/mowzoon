// Five questions, four options each. Every option is written as a person
// you might be, so the answers separate the four archetypes cleanly.
// Options carry weights on the three metrics (e = spending efficiency,
// r = proactive resilience, q = financial EQ); scores start at 50. The
// Arabic mirror is SURVEY_AR in i18n.jsx and must stay index-aligned.
// Classification itself is determineArchetype() in scoring.js.

export const SURVEY = [
  {
    category: 'Instincts',
    text: 'A SAR 5,000 bonus lands tonight. Where is it a week later?',
    options: [
      { label: 'Mostly invested. I moved it before the weekend.', e: 8, r: -6, q: 1 },
      { label: 'Mostly gone. A trip, some gifts, a few good nights out.', e: -7, r: -4, q: -8 },
      { label: 'Still sitting in checking, untouched. Just in case.', e: -3, r: 9, q: 2 },
      { label: 'Some saved, some spent. I planned it that way.', e: 7, r: 5, q: 6 },
    ],
  },
  {
    category: 'Resilience',
    text: 'Your car needs a SAR 1,200 repair by tomorrow morning. How does it get paid?',
    options: [
      { label: 'My emergency fund exists for exactly this.', r: 12, e: 3, q: 2 },
      { label: 'Credit card. Future me can figure it out.', r: -10, q: -5 },
      { label: 'I would have to borrow from someone close.', r: -8, e: -2, q: -2 },
      { label: 'Cash covers it, but the rest of the month turns tight.', r: 2, e: 1 },
    ],
  },
  {
    category: 'Awareness',
    text: 'Without opening your bank app, how close could you guess what you spent this month?',
    options: [
      { label: 'Within about SAR 100. I know my number.', e: 10, q: 5, r: 2 },
      { label: 'Within a few hundred, give or take.', e: 4, q: 2 },
      { label: 'Honestly, I would be off by a lot.', e: -8, q: -3 },
      { label: 'I avoid looking. The number stresses me out.', e: -5, q: -6, r: -2 },
    ],
  },
  {
    category: 'Impulse',
    text: "It's past midnight, you can't sleep, and something is waiting in your cart. What usually happens?",
    options: [
      { label: 'Checked out before I can talk myself out of it.', q: -12, e: -6 },
      { label: 'I sleep on it. Most carts die by morning.', q: 9, e: 4 },
      { label: 'Depends on the month. Payday makes me reckless.', q: -3, e: -1 },
      { label: 'My cart stays empty. Wanting is not buying.', q: 10, e: 3, r: 2 },
    ],
  },
  {
    category: 'Strategy',
    text: 'Which sentence sounds most like your money right now?',
    options: [
      { label: 'Big bets and thin savings, but the upside is worth it.', e: 5, r: -11, q: -4 },
      { label: 'Every riyal has a job, with categories, limits, and reviews.', e: 11, r: 4, q: 3 },
      { label: 'Fixed costs eat almost everything. I get through the month.', e: -4, r: -7, q: 1 },
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
