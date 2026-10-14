import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/next';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
