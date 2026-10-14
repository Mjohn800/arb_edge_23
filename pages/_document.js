import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.webp" type="image/webp" sizes="48x48" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon-180.png" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0b1220" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="ArbEdge" />
        <meta name="description" content="ArbEdge: live arbitrage and +EV bets for football. Free to start. 18+." />
        {/* Link previews (WhatsApp, Telegram, iMessage, X). Addresses must be absolute https:// URLs. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ArbEdge" />
        <meta property="og:title" content="ArbEdge" />
        <meta property="og:description" content="ArbEdge: live arbitrage and +EV bets for football. Free to start. 18+." />
        <meta property="og:url" content="https://arbedges.vercel.app" />
        <meta property="og:image" content="https://arbedges.vercel.app/icon-512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="ArbEdge" />
        <meta name="twitter:description" content="ArbEdge: live arbitrage and +EV bets for football. Free to start. 18+." />
        <meta name="twitter:image" content="https://arbedges.vercel.app/icon-512.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
