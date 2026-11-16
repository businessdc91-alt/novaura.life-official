/**
 * kernelStorage - Unified storage interface for NovAura
 * Wraps localStorage with error handling and type safety
 * Future: Can be swapped with Redis, Firebase, or distributed storage
 */

export const kernelStorage = {
  /**
   * Get item from storage
   * @param {string} key
   * @returns {string | null}
   */
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`[kernelStorage] Error getting ${key}:`, error);
      return null;
    }
  },

  /**
   * Set item in storage
   * @param {string} key
   * @param {string} value
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`[kernelStorage] Error setting ${key}:`, error);
      // Handle quota exceeded - remove old items
      if (error.name === 'QuotaExceededError') {
        this._cleanupOldItems();
        try {
          localStorage.setItem(key, value);
        } catch (retryError) {
          console.error('[kernelStorage] Failed even after cleanup:', retryError);
        }
      }
    }
  },

  /**
   * Remove item from storage
   * @param {string} key
   */
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[kernelStorage] Error removing ${key}:`, error);
    }
  },

  /**
   * Clear all NovAura related storage
   */
  clear() {
    try {
      // Only clear keys starting with 'novaura_'
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('novaura_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('[kernelStorage] Error clearing storage:', error);
    }
  },

  /**
   * Get all keys starting with prefix
   * @param {string} prefix
   * @returns {string[]}
   */
  getKeysByPrefix(prefix) {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    } catch (error) {
      console.error('[kernelStorage] Error getting keys:', error);
    }
    return keys;
  },

  /**
   * Get storage usage stats
   * @returns {{ used: number, total: number, percent: number }}
   */
  getUsage() {
    try {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          used += key.length + (localStorage.getItem(key)?.length || 0);
        }
      }
      // Approximate 5MB limit
      const total = 5 * 1024 * 1024;
      return {
        used,
        total,
        percent: Math.round((used / total) * 100)
      };
    } catch (error) {
      console.error('[kernelStorage] Error getting usage:', error);
      return { used: 0, total: 0, percent: 0 };
    }
  },

  /**
   * Cleanup old items when quota exceeded
   * @private
   */
  _cleanupOldItems() {
    const items = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('novaura_')) {
          items.push({
            key,
            timestamp: parseInt(key.match(/_(\d+)_/)?.[1] || '0'),
          });
        }
      }
      // Sort by timestamp (oldest first) and remove oldest 20%
      items.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = Math.ceil(items.length * 0.2);
      items.slice(0, toRemove).forEach(item => {
        localStorage.removeItem(item.key);
      });
    } catch (error) {
      console.error('[kernelStorage] Error during cleanup:', error);
    }
  }
};

export default kernelStorage;
