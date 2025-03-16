import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Navigation from './Navigation';

export default function Layout({ children }) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Pages that don't need the navigation sidebar
  const noNavPages = ['/login', '/register', '/reset-password'];
  
  // Check if the current page is an auth page
  const isAuthPage = noNavPages.includes(router.pathname);
  
  // Check if it's a landing page (home without auth)
  const isLandingPage = router.pathname === '/' && !user;
  
  // Determine if we should show navigation
  const showNavigation = !isAuthPage && !isLandingPage && user;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        {showNavigation && <Navigation />}
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
} 