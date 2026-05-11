import React from 'react';

/**
 * Standardized Avatar Component for NovAura Platform
 * 
 * @param {Object} props
 * @param {Object} props.user - User object with displayName, avatar/photoURL, and status
 * @param {string} props.size - sm | md | lg | xl
 * @param {boolean} props.showStatus - Whether to show the online/offline status dot
 * @param {string} props.className - Additional classes
 */
export default function Avatar({ user, size = 'md', showStatus = false, className = '' }) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-xl',
    xl: 'w-20 h-20 text-3xl'
  };
  
  const statusColors = {
    online: 'bg-green-400',
    away: 'bg-yellow-400',
    offline: 'bg-gray-500'
  };
  
  const displayName = user?.displayName || user?.name || user?.username || 'User';
  const avatarData = user?.avatar || user?.photoURL;
  const isUrl = typeof avatarData === 'string' && (avatarData.startsWith('http') || avatarData.startsWith('/') || avatarData.startsWith('data:'));
  const status = user?.status || 'offline';
  
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-white/10 text-gray-200 overflow-hidden`}>
        {isUrl ? (
          <img src={avatarData} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span className="font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {showStatus && (
        <div 
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${statusColors[status]} border-2 border-[#0a0a0f] shadow-lg`}
          title={status}
        />
      )}
    </div>
  );
}
