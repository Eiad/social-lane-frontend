import '../styles/globals.scss';
import ToastContainer from '../src/components/ToastContainer';
import { AuthProvider } from '../src/context/AuthContext';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <main className="app-main">
        <Component {...pageProps} />
        <ToastContainer />
      </main>
    </AuthProvider>
  );
} 