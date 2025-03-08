import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import styles from '../../styles/Navigation.module.scss';

const Navigation = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSignOut = async () => {
    const result = await signOut();
    if (result?.success) {
      router.push('/');
      setIsMenuOpen(false);
    }
  };

  return (
    <nav className={styles.navigation}>
      <div className={styles.logo}>
        <Link href="/">
          <span>Social Lane</span>
        </Link>
      </div>
      
      <div className={styles.mobileMenuButton} onClick={toggleMenu}>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <ul className={`${styles.navLinks} ${isMenuOpen ? styles.open : ''}`}>
        <li>
          <Link href="/">
            <span className={router.pathname === '/' ? styles.active : ''}>Home</span>
          </Link>
        </li>
        
        {user ? (
          <>
            <li>
              <Link href="/social-posting">
                <span className={router.pathname === '/social-posting' ? styles.active : ''}>Social Post</span>
              </Link>
            </li>
            <li>
              <Link href="/scheduled-posts">
                <span className={router.pathname === '/scheduled-posts' ? styles.active : ''}>Scheduled Posts</span>
              </Link>
            </li>
            <li>
              <Link href="/my-account">
                <span className={router.pathname === '/my-account' ? styles.active : ''}>My Account</span>
              </Link>
            </li>
            <li>
              <button className={styles.signOutButton} onClick={handleSignOut}>Sign Out</button>
            </li>
          </>
        ) : (
          <li>
            <Link href="/my-account">
              <span className={router.pathname === '/my-account' ? styles.active : ''}>Sign In</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Navigation; 