import '../styles/globals.scss';
import ToastContainer from '../src/components/ToastContainer';

export default function App({ Component, pageProps }) {
  return (
    <main className="app-main">
      <Component {...pageProps} />
      <ToastContainer />
    </main>
  );
} 