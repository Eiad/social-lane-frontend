import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

// Navigation Icons
const HomeIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const PostIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const CalendarIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const UserIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const HistoryIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LogoutIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const ConnectIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const AccountsIcon = ({ className = "w-6 h-6" }) => (
  <svg  xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  
  // Initialize expandedMenus with 'accounts' expanded if Twitter or TikTok page is active
  const [expandedMenus, setExpandedMenus] = useState(() => {
    // Auto-expand Accounts menu if current route is Twitter or TikTok
    return {
      accounts: ['/twitter', '/tiktok'].includes(router.pathname)
    };
  });

  const isActive = (path) => {
    return router.pathname === path;
  };
  
  const isSubmenuActive = (submenuItems) => {
    return submenuItems.some(item => isActive(item.href));
  };

  useEffect(() => {
    if (user?.displayName) {
      const names = user.displayName.split(' ');
      setFirstName(names[0]);
    }
    
    if (user?.photoURL) {
      setProfileImage(user.photoURL);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      localStorage?.clear();
      const result = await signOut();
      if (result?.success) {
        router.push('/');
      } else {
        console.error('Failed to log out', result?.error);
      }
    } catch (error) {
      console.error('Exception during logout:', error);
    }
  };
  
  const toggleSubmenu = (id) => {
    setExpandedMenus(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const navigationItems = [
    {
      name: 'Media Posting',
      href: '/media-posting',
      icon: <HomeIcon />,
      current: isActive('/media-posting')
    },
    {
      name: 'Schedule Posts',
      href: '/scheduled-posts',
      icon: <CalendarIcon />,
      current: isActive('/scheduled-posts')
    },
    {
      name: 'Posts History',
      href: '/posts-history',
      icon: <HistoryIcon />,
      current: isActive('/posts-history')
    },
    {
      id: 'accounts',
      name: 'Accounts',
      icon: <AccountsIcon />,
      hasSubmenu: true,
      current: isSubmenuActive([
        { href: '/twitter' },
        { href: '/tiktok' }
      ]),
      submenu: [
        {
          name: 'Twitter',
          href: '/twitter',
          icon: <ConnectIcon />,
          current: isActive('/twitter')
        },
        {
          name: 'TikTok',
          href: '/tiktok',
          icon: <ConnectIcon />,
          current: isActive('/tiktok')
        }
      ]
    },
    {
      name: 'My Account',
      href: '/my-account',
      icon: <UserIcon />,
      current: isActive('/my-account')
    }
  ];

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Mobile menu */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:hidden fixed inset-0 z-40 flex`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setMobileMenuOpen(false)}></div>
        
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="sr-only">Close sidebar</span>
              <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <span className="text-xl font-bold text-indigo-600">Social Lane</span>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigationItems.map((item) => (
                <div key={item.name}>
                  {item.hasSubmenu ? (
                    <>
                      <button
                        onClick={() => toggleSubmenu(item.id)}
                        className={`${
                          item.current
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        } group flex items-center justify-between w-full px-2 py-2 text-base font-medium rounded-md`}
                      >
                        <div className="flex items-center">
                          <div className={`${
                            item.current ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                          } mr-4 flex-shrink-0`}>
                            {item.icon}
                          </div>
                          {item.name}
                        </div>
                        <ChevronDownIcon className={`transform transition-transform duration-200 ${expandedMenus[item.id] ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {expandedMenus[item.id] && (
                        <div className="pl-8 mt-1 space-y-1">
                          {item.submenu.map((subItem) => (
                            <Link
                              key={subItem.name}
                              href={subItem.href}
                              className={`${
                                subItem.current
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                            >
                              <div className={`${
                                subItem.current ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                              } mr-3 flex-shrink-0`}>
                                {subItem.icon}
                              </div>
                              {subItem.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={`${
                        item.current
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                    >
                      <div className={`${
                        item.current ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                      } mr-4 flex-shrink-0`}>
                        {item.icon}
                      </div>
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </div>
          
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex-shrink-0 group block">
              <div className="flex items-center">
                <div>
                  {profileImage ? (
                    <img className="inline-block h-10 w-10 rounded-full" src={profileImage} alt={firstName} />
                  ) : (
                    <div className="inline-flex h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 items-center justify-center">
                      <span className="font-medium text-lg">{firstName?.charAt(0) || 'U'}</span>
                    </div>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-base font-medium text-gray-700 group-hover:text-gray-900">
                    {firstName || 'User'}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-gray-500 group-hover:text-gray-700 flex items-center"
                  >
                    <LogoutIcon className="mr-1 h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-shrink-0 w-14" aria-hidden="true">
          {/* Dummy element to force sidebar to shrink to fit close icon */}
        </div>
      </div>
  
      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:flex-shrink-0 h-full">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-full flex-1 border-r border-gray-200 bg-white">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <span className="text-xl font-bold text-indigo-600">Social Lane</span>
              </div>
              <nav className="mt-8 flex-1 px-2 bg-white space-y-2">
                {navigationItems.map((item) => (
                  <div key={item.name}>
                    {item.hasSubmenu ? (
                      <>
                        <button
                          onClick={() => toggleSubmenu(item.id)}
                          className={`${
                            item.current
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          } group flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 accounts-menu`}
                        >
                          <div className="flex items-center">
                            <div className={`${
                              item.current ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                            } mr-3 flex-shrink-0`}>
                              {item.icon}
                            </div>
                            {item.name}
                          </div>
                          <ChevronDownIcon className={`transform transition-transform duration-200 ${expandedMenus[item.id] ? 'rotate-180' : ''}`} />
                        </button>
                        
                        <div className={`pl-10 mt-1 space-y-1 ${expandedMenus[item.id] ? 'block' : 'hidden'}`}>
                          {item.submenu.map((subItem) => (
                            <Link
                              key={subItem.name}
                              href={subItem.href}
                              className={`${
                                subItem.current
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              } group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150`}
                            >
                              <div className={`${
                                subItem.current ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                              } mr-3 flex-shrink-0`}>
                                {subItem.icon}
                              </div>
                              {subItem.name}
                            </Link>
                          ))}
                        </div>
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        className={`${
                          item.current
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        } group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150`}
                      >
                        <div className={`${
                          item.current ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-3 flex-shrink-0`}>
                          {item.icon}
                        </div>
                        {item.name}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <div className="flex-shrink-0 w-full group block">
                <div className="flex items-center">
                  <div>
                    {profileImage ? (
                      <img className="inline-block h-10 w-10 rounded-full" src={profileImage} alt={firstName} />
                    ) : (
                      <div className="inline-flex h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 items-center justify-center">
                        <span className="font-medium text-lg">{firstName?.charAt(0) || 'U'}</span>
                      </div>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-base font-medium text-gray-700 group-hover:text-gray-900">
                      {firstName || 'User'}
                    </p>
                    <button
                      onClick={handleLogout}
                      className="text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1 px-2 rounded-md flex items-center transition-colors duration-200"
                    >
                      <LogoutIcon className="mr-1 h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  
      {/* Mobile header */}
      <div className="md:hidden w-full">
        <div className="pl-1 pt-1 sm:pl-3 sm:pt-3 flex items-center">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-4">
            <span className="text-lg font-bold text-indigo-600">Social Lane</span>
          </div>
        </div>
      </div>
    </>
  );
} 