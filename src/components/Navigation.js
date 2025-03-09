import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

// Icons
const HomeIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const PostIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"></path>
  </svg>
);

const CalendarIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const UserIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const LogoutIcon = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

const Navigation = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check initially
    checkIsMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIsMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSignOut = async () => {
    const result = await signOut?.();
    if (result?.success) {
      router.push('/');
      setIsMenuOpen(false);
    }
  };

  // Navigation links configuration
  const navLinks = [
    { 
      href: '/',
      label: 'Home',
      icon: <HomeIcon className="w-6 h-6" />
    },
    { 
      href: '/social-posting',
      label: 'Create Post',
      icon: <PostIcon className="w-6 h-6" />,
      requiresAuth: true
    },
    { 
      href: '/scheduled-posts',
      label: 'Scheduled Posts',
      icon: <CalendarIcon className="w-6 h-6" />,
      requiresAuth: true
    },
    { 
      href: '/my-account',
      label: user ? 'My Account' : 'Sign In',
      icon: <UserIcon className="w-6 h-6" />
    }
  ];

  // Filter links based on authentication status
  const filteredLinks = navLinks.filter(link => !link.requiresAuth || user);

  // Mobile menu button
  const MobileMenuButton = () => (
    <button 
      onClick={toggleMenu}
      className="flex items-center md:hidden fixed top-4 right-4 z-50 p-2 rounded-full bg-white shadow-md"
      aria-label="Toggle menu"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-6 w-6 text-gray-700" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        {isMenuOpen ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        )}
      </svg>
    </button>
  );

  // Logo component
  const Logo = () => (
    <div className="py-6 px-4">
      <Link href="/" className="flex items-center">
        <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
          Social Lane
        </span>
      </Link>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <MobileMenuButton />

      {/* Main Navigation */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col w-64 h-screen bg-white shadow-lg transition-transform duration-300 ease-in-out
          ${isMobile && !isMenuOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        {/* Logo */}
        <Logo />
        
        {/* Navigation Links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="px-2 space-y-1">
            {filteredLinks.map((link) => {
              const isActive = router.pathname === link.href;
              
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => isMobile && setIsMenuOpen(false)}
                    className={`
                      flex items-center px-4 py-3 text-gray-700 rounded-lg group transition-all duration-200
                      ${isActive 
                        ? 'bg-primary/10 text-primary font-medium' 
                        : 'hover:bg-gray-100'
                      }
                    `}
                  >
                    <span className={`
                      transition-all duration-200
                      ${isActive 
                        ? 'text-primary' 
                        : 'text-gray-500 group-hover:text-gray-700'
                      }
                    `}>
                      {link.icon}
                    </span>
                    <span className="ml-3">{link.label}</span>
                    
                    {isActive && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-primary"></span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* User Section (only show if authenticated) */}
        {user && (
          <div className="flex-shrink-0 p-4 mt-auto border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0">
                {user?.photoURL ? (
                  <img 
                    src={user?.photoURL} 
                    alt={user?.displayName || "User"}
                    className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserIcon className="w-5 h-5" />
                  </div>
                )}
                
                <div className="ml-3 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.displayName || "User"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email || ""}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleSignOut}
                className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200"
                aria-label="Sign out"
              >
                <LogoutIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </aside>
      
      {/* Overlay for mobile */}
      {isMobile && isMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-800 bg-opacity-50 z-30"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}
      
      {/* Main content spacer */}
      <div className="md:ml-64"></div>
    </>
  );
};

export default Navigation; 