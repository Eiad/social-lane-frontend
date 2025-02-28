import '../styles/globals.scss';

export default function App({ Component, pageProps }) {
  return (
    <main className="app-main">
      <Component {...pageProps} />
    </main>
  );
} 