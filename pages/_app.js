import '../styles/globals.scss';
import ToastContainer from '../src/components/ToastContainer';
import Layout from '../src/components/Layout';
import { AuthProvider } from '../src/context/AuthContext';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Layout>
        <Component {...pageProps} />
        <ToastContainer />
      </Layout>
    </AuthProvider>
  );
} 