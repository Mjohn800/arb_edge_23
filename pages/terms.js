import React from 'react';
const e = React.createElement;

// Lightweight renderer: lines starting with "## " become headers, "> " become
// a highlighted note box, everything else is a paragraph. Keeps this page
// easy to update later — just edit the CONTENT string below, no JSX wrangling.
const CONTENT = `
## 1. Acceptance of Terms
By creating an account or using ArbEdge ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.

## 2. What ArbEdge Is
ArbEdge is an odds-comparison and sports-betting information tool. It aggregates publicly available odds from third-party sportsbooks and presents arbitrage opportunities, value-bet (+EV) calculations, and related analytics.

ArbEdge is not a bookmaker, betting exchange, or gambling operator. ArbEdge does not accept wagers or bets of any kind, does not hold, process, or transmit betting funds, does not facilitate the placement of bets on your behalf, and is not a licensed gambling operator, because it does not offer games of chance or accept bets.

Any bet you place is placed directly with a third-party licensed sportsbook (e.g. SportyBet, Betway, 1xBet, Pinnacle, Bet365), under that sportsbook's own terms, odds, and licensing. ArbEdge has no involvement in, and no responsibility for, that transaction.

## 3. Eligibility
You must be 18 years or older, or the legal age for betting where you live if that is higher (for example, 21 in some US states), to use ArbEdge. By creating an account, you confirm that you meet this requirement.

Sports betting is regulated differently in every jurisdiction. It is your responsibility to confirm that sports betting, and use of odds-comparison tools, is legal where you live before using this Service or acting on any information it provides.

ArbEdge is available to users worldwide, but not every sportsbook shown will be available to you, and the Service may not be lawful in every location. ArbEdge is not available in the United States, because we do not have odds coverage for US sportsbooks, and we may block access and payments from there. We may restrict access from some other countries at any time.

## 4. No Guarantee of Accuracy or Profit
Odds displayed on ArbEdge are pulled from third-party sources and may be delayed, incorrect or stale, or refused/limited by the sportsbook even where ArbEdge shows a valid opportunity. Labels such as accessible or not accessible are general guidance about sportsbook availability by region. They may be wrong and are not a guarantee that you can open an account or place a bet with that sportsbook.

ArbEdge does not guarantee any profit, and using this Service carries real financial risk. Arbitrage and +EV betting are strategies with historical statistical grounding, not guarantees. This Service does not constitute financial, investment, or professional betting advice.

## 5. Your Account
You're responsible for keeping your login credentials secure and for all activity under your account.

## 6. Acceptable Use
You agree not to use automated tools, bots, or scripts to access the Service beyond normal use or to circumvent rate limits, or to scrape or reverse-engineer the Service's underlying data feeds. We reserve the right to suspend or terminate accounts that violate this section.

## 7. Affiliate Relationships
ArbEdge may earn referral commissions when you sign up with a sportsbook through a link shown in the Service. This does not affect the odds displayed to you, and does not influence which opportunities are shown.

## 7A. Premium Subscription and Payments
ArbEdge offers a free plan with access to a limited set of leagues, and a paid Premium plan that unlocks all scanned leagues, AI bet analysis, and other features. We may change which features and leagues are included in each plan.

Premium is sold for 30-day periods. The price that applies to you is shown before you pay and may depend on where you are. Payments are charged in Ghana cedis (GHS): if the price is shown in another currency, it is converted to cedis at the exchange rate at checkout, and your card issuer may convert it to your own currency and add its own fees. We may change prices at any time; a price change applies to your next purchase or renewal.

Payments are processed by Paystack. We do not see or store your card number or mobile money PIN. Premium access is activated automatically once Paystack confirms your payment. If it has not activated within a few minutes, contact us.

You can pay for a single 30-day period, which does not renew automatically, or, where offered, choose automatic renewal by card, which charges you every 30 days until you cancel. You can cancel automatic renewal at any time before the next charge, and your Premium access continues until the end of the period you already paid for.

Payments are non-refundable, except where required by law or where you were charged in error (for example, charged twice). If that happens, contact us within 7 days and we will review it.

Premium provides tools and information only. It does not guarantee profit (see Section 4).

## 8. Third-Party Links and Services
The Service links to and displays data from third-party sportsbooks and relies on third-party infrastructure. ArbEdge is not responsible for the content, accuracy, availability, or practices of any third-party site or service you interact with.

## 9. Taxes
Any taxes applicable to betting winnings are a matter between you and the licensed sportsbook where you placed the bet. ArbEdge has no role in tax matters related to bets you place elsewhere.

## 10. Limitation of Liability
To the fullest extent permitted by law, ArbEdge and its owner/operator are not liable for any losses arising from your use of the Service, including losses from bets placed based on information shown in the Service, inaccurate or delayed odds, or third-party sportsbook actions. The Service is provided "as is," without warranties of any kind.

## 11. Termination
We may suspend or terminate your access to the Service at any time, for any reason, including violation of these Terms.

## 12. Changes to These Terms
We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.

## 13. Governing Law
These Terms are governed by the laws of the Republic of Ghana. This does not remove any mandatory consumer-protection rights you have under the law of the country where you live.

## 14. Contact
Questions about these Terms: lexjhn1390@gmail.com
`;

function renderContent(text) {
  return text.trim().split('\n\n').map((block, i) => {
    const lines = block.trim().split('\n');
    if (lines[0].startsWith('## ')) {
      return e('div', { key: i, style: { marginBottom: 20 } },
        e('h2', { style: { fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#0f172a' } }, lines[0].replace('## ', '')),
        lines.slice(1).map((p, j) => e('p', { key: j, style: { fontSize: 14, lineHeight: 1.7, color: '#374151', marginBottom: 8 } }, p))
      );
    }
    return e('p', { key: i, style: { fontSize: 14, lineHeight: 1.7, color: '#374151', marginBottom: 16 } }, block);
  });
}

export default function Terms() {
  return e('div', { style: { maxWidth: 720, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui' } },
    e('h1', { style: { fontSize: 26, fontWeight: 800, marginBottom: 4, color: '#0f172a' } }, 'ArbEdge — Terms of Service'),
    e('div', { style: { fontSize: 13, color: '#6b7280', marginBottom: 28 } }, 'Last updated: 20 September 2026'),
    renderContent(CONTENT),
    e('div', { style: { background: '#fef3c7', borderRadius: 10, padding: '14px 16px', marginTop: 24, fontSize: 13, color: '#78350f', fontWeight: 700, textAlign: 'center' } },
      '⚖️ Gamble Responsibly. Only 18+ Years. Gambling is Addictive.'
    ),
    e('a', { href: '/', style: { display: 'inline-block', marginTop: 24, color: '#0f172a', fontWeight: 600, fontSize: 14 } }, '← Back to ArbEdge')
  );
}
