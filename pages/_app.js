import '../styles/globals.scss';
import ToastContainer from '../src/components/ToastContainer';
import Layout from '../src/components/Layout';
import { AuthProvider } from '../src/context/AuthContext';
import { LoaderProvider } from '../src/context/LoaderContext';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <LoaderProvider>
        <Layout>
          <Component {...pageProps} />
          <ToastContainer />
        </Layout>
      </LoaderProvider>
    </AuthProvider>
  );
} 