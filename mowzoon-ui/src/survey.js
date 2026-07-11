// each option carries weights on the three metrics (e = spending efficiency,
// r = proactive resilience, q = financial EQ), scores start at 50.
// classification itself is determineArchetype() in scoring.js

export const SURVEY = [
  {
    category: 'Instincts',
    text: 'You suddenly receive a SAR 5,000 bonus. What actually happens next?',
    options: [
      { label: 'Straight into investments before I can think twice.', e: 9, r: -5, q: 1 },
      { label: 'A spontaneous trip. Money like this is for living.', e: -5, r: -3, q: -8 },
      { label: 'It sits in checking. Untouched. Just in case.', e: -3, r: 8, q: 2 },
    ],
  },
  {
    category: 'Habits',
    text: 'How well do you know your active subscriptions?',
    options: [
      { label: "No idea. They renew, I notice sometimes.", e: -8, q: -3 },
      { label: 'I skim my statement about once a month.', e: 4, r: 2 },
      { label: 'Every one is tracked, priced, and reviewed.', e: 8, r: 2, q: 3 },
    ],
  },
  {
    category: 'Resilience',
    text: 'Your car needs a SAR 1,000 repair by tomorrow. How does it get paid?',
    options: [
      { label: "Credit card. Future me can figure it out.", r: -9, q: -4 },
      { label: 'My emergency fund exists for exactly this.', r: 10, e: 3 },
      { label: 'I would have to borrow from someone close.', r: -7, e: -2 },
    ],
  },
  {
    category: 'Impulse',
    text: "It's past midnight and you can't sleep. How dangerous is your phone?",
    options: [
      { label: 'Very. Late-night carts are how I unwind.', q: -10, e: -6 },
      { label: 'Only a genuinely big sale can tempt me.', q: 3 },
      { label: "Not at all. I don't buy on impulse.", q: 8, e: 3 },
    ],
  },
  {
    category: 'Strategy',
    text: 'Which is closest to your investment style?',
    options: [
      { label: 'Aggressive. Crypto, options, big swings.', e: 6, r: -9, q: -4 },
      { label: 'Diversified and boring, exactly as intended.', e: 7, r: 5, q: 2 },
      { label: "I don't invest. Cash feels safer.", e: -6, r: 4, q: 2 },
    ],
  },
  {
    category: 'Habits',
    text: 'Do you actually have a budget?',
    options: [
      { label: 'No. I spend, and the balance is what it is.', e: -7, q: -4 },
      { label: 'A rough number I keep in my head.', e: 1, q: 1 },
      { label: 'A real one, with categories, limits, reviews.', e: 7, r: 3, q: 2 },
    ],
  },
  {
    category: 'Social',
    text: 'Friends invite you somewhere expensive on a tight month. You...',
    options: [
      { label: 'Go. Worry about the damage afterwards.', q: -7, e: -4 },
      { label: 'Go, then quietly rebalance the rest of the month.', q: 4, e: 2 },
      { label: 'Decline, and feel guilty about money all night.', r: 4, e: -6, q: -2 },
    ],
  },
  {
    category: 'Resilience',
    text: 'If your income stopped today, how long could you keep your life running?',
    options: [
      { label: 'Less than a month. It gets ugly fast.', r: -9 },
      { label: 'One to three months if I am careful.', r: 3 },
      { label: 'Six months or more, comfortably.', r: 10, e: 2 },
    ],
  },
  {
    category: 'Impulse',
    text: 'How often does "I deserve this" win at checkout?',
    options: [
      { label: 'Often. It is my main financial philosophy.', q: -8, e: -5 },
      { label: 'Sometimes, usually around payday.', q: 2 },
      { label: 'Almost never. Wanting is not buying.', q: 7, e: 2, r: 2 },
    ],
  },
  {
    category: 'Awareness',
    text: 'What happens in your body when you open your banking app?',
    options: [
      { label: "Nothing, because I avoid opening it.", q: -6, r: -4 },
      { label: 'Calm. I already know roughly what is there.', q: 6, r: 3 },
      { label: 'A spike of anxiety, even when the number is fine.', q: -2, r: 5, e: -5 },
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
