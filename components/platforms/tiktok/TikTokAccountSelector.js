import React from 'react';
import Link from 'next/link';
import { TikTokSimpleIcon } from '../../../src/components/icons/SocialIcons';
import styles from '../../../styles/SocialPosting.module.css';

const TikTokAccountSelector = ({
  tiktokAccounts = [],
  selectedTiktokAccounts = [],
  handleTikTokAccountToggle,
  searchTerm = '',
}) => {
  const filteredTiktokAccounts = tiktokAccounts.filter(account => 
    account?.username?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    account?.displayName?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    account?.userInfo?.display_name?.toLowerCase()?.includes(searchTerm.toLowerCase())
  );

  if (tiktokAccounts.length === 0) {
    return (
      <div className={styles.noAccountsMessage}>
        <p>No TikTok accounts connected.</p>
        <Link href="/tiktok" legacyBehavior>
          <a className={styles.connectLink}>
            <button className={styles.connectButton} type="button">
              <TikTokSimpleIcon width="20" height="20" />
              Connect TikTok Account
            </button>
          </a>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.accountsSection}>
      <h3>Select TikTok Accounts</h3>
      <div className={styles.accountsList}>
        {filteredTiktokAccounts.map(account => (
          <div 
            key={account.openId}
            className={`${styles.accountCard} ${
              selectedTiktokAccounts.some(acc => acc.openId === account.openId) 
                ? styles.selectedAccount 
                : ''
            }`}
            onClick={() => handleTikTokAccountToggle(account)}
          >
            <div className={styles.accountInfo}>
              <TikTokSimpleIcon width="24" height="24" />
              <span className={styles.accountName}>
                {account.displayName || account.userInfo?.display_name || account.username || (account.openId ? `@${account.openId.substring(0, 10)}...` : 'TikTok Account')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={selectedTiktokAccounts.some(acc => acc.openId === account.openId)}
              onChange={(e) => {
                e.stopPropagation();
                handleTikTokAccountToggle(account);
              }}
              className={styles.accountCheckbox}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TikTokAccountSelector; 