import React from 'react';
const e = React.createElement;

const CONTENT = `
## 1. Introduction
This Privacy Policy explains how ArbEdge ("we," "us") collects, uses, stores, and protects your personal information, in accordance with Ghana's Data Protection Act, 2012 (Act 843) and, for users in Nigeria, the Nigeria Data Protection Act, 2023.

## 2. What We Collect
Account information: email address and password (hashed, never stored in plain text — handled by Supabase). Bet-tracking data: any bets, odds, stakes, or outcomes you choose to log. Usage data: sports/league preferences, stored locally on your device. Affiliate activity: click-throughs to sportsbooks, recorded for commission tracking.

We do not collect payment card details, government ID numbers, or any data related to bets you place directly with third-party sportsbooks — we have no access to your sportsbook accounts.

## 3. How We Use Your Information
To provide and operate the Service, to improve the product, to track affiliate referrals for commission purposes, and to communicate with you about your account. We do not sell your personal data to third parties.

## 4. Legal Basis for Processing
We process your personal data based on your consent, given when you create an account, and where applicable, our legitimate interest in operating and improving the Service.

## 5. Third-Party Processors
Supabase handles account authentication and database hosting (EU/Ireland region) — receives your email, hashed password, and bet-tracking data. Groq provides AI-powered bet analysis — receives match name, sport, and odds you submit for analysis, not your identity or account details. Odds data providers supply publicly available odds — this is one-way data flowing into the app; nothing of yours is sent to them.

## 5A. International Data Transfers
Your data is processed outside Ghana and Nigeria. Supabase hosts our database in Ireland (EU), and Groq, which provides AI bet analysis, processes the match, sport and odds details you submit on servers that may be located in the United States. We share only what each provider needs to do its job, and we rely on their security commitments to protect your data.

## 5B. Users in Nigeria
If you use ArbEdge from Nigeria, we also process your personal data in line with the Nigeria Data Protection Act, 2023. You have the rights to access, correct, delete, restrict, port, and object to processing of your data, as described in Section 7, and you may complain to the Nigeria Data Protection Commission.

## 6. Data Retention
We retain your account and bet-tracking data for as long as your account remains active. If you delete your account, associated data is removed within a reasonable period, except where retention is required by law.

## 7. Your Rights (under Act 843)
You have the right to access the personal data we hold about you, correct inaccurate data, withdraw consent for processing, object to processing including for direct marketing, and complain to Ghana's Data Protection Commission if you believe your rights have been violated. To exercise any of these rights, contact us at lexjhn1390@gmail.com.

## 8. Security
We use industry-standard security practices, including encrypted data transit and database-level access controls (row-level security), so your data is only accessible to your own authenticated account.

## 9. Cookies & Local Storage
The app uses your browser's local storage, not cookies, to remember preferences like selected sports and scan timing, on your own device. This is not used for cross-site tracking or advertising.

## 10. Children's Privacy
The Service is not intended for anyone under 18. We do not knowingly collect data from minors.

## 11. Data Breach Notification
In the event of a data breach affecting your personal information, we will notify affected users and the Data Protection Commission within a reasonable time frame, consistent with Act 843.

## 12. Changes to This Policy
We may update this Privacy Policy from time to time. Material changes will be reflected in the "Last updated" date above.

## 13. Contact
Questions about this Privacy Policy or your data: lexjhn1390@gmail.com
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

export default function Privacy() {
  return e('div', { style: { maxWidth: 720, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui' } },
    e('h1', { style: { fontSize: 26, fontWeight: 800, marginBottom: 4, color: '#0f172a' } }, 'ArbEdge — Privacy Policy'),
    e('div', { style: { fontSize: 13, color: '#6b7280', marginBottom: 28 } }, 'Last updated: 19 September 2026'),
    renderContent(CONTENT),
    e('a', { href: '/', style: { display: 'inline-block', marginTop: 24, color: '#0f172a', fontWeight: 600, fontSize: 14 } }, '← Back to ArbEdge')
  );
}
