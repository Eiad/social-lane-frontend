import React from 'react';
import Link from 'next/link';
import { TwitterIcon } from '../../../src/components/icons/SocialIcons';
import styles from '../../../styles/SocialPosting.module.css';

const TwitterAccountSelector = ({
  twitterAccounts = [],
  selectedTwitterAccounts = [],
  handleTwitterAccountToggle,
  searchTerm = '',
}) => {
  const filteredTwitterAccounts = twitterAccounts.filter(account => 
    account?.username?.toLowerCase()?.includes(searchTerm.toLowerCase())
  );

  if (twitterAccounts.length === 0) {
    return (
      <div className={styles.noAccountsMessage}>
        <p>No Twitter accounts connected.</p>
        <Link href="/twitter" legacyBehavior>
          <a className={styles.connectLink}>
            <button className={styles.connectButton} type="button">
              <TwitterIcon width="20" height="20" />
              Connect Twitter Account
            </button>
          </a>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.accountsSection}>
      <h3>Select Twitter Accounts</h3>
      <div className={styles.accountsList}>
        {filteredTwitterAccounts.map(account => (
          <div 
            key={account.userId}
            className={`${styles.accountCard} ${
              selectedTwitterAccounts.some(acc => acc.userId === account.userId) 
                ? styles.selectedAccount 
                : ''
            }`}
            onClick={() => handleTwitterAccountToggle(account)}
          >
            <div className={styles.accountInfo}>
              <TwitterIcon width="24" height="24" />
              <span className={styles.accountName}>
                {account.username || account.userId || 'Twitter Account'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={selectedTwitterAccounts.some(acc => acc.userId === account.userId)}
              onChange={(e) => {
                e.stopPropagation();
                handleTwitterAccountToggle(account);
              }}
              className={styles.accountCheckbox}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TwitterAccountSelector; 