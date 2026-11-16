// Simple Pub/Sub for theme events
window.NovAura = window.NovAura || {};

Novaura.PubSub = {
  events: {},
  
  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  },
  
  publish(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  },
  
  once(event, callback) {
    const unsubscribe = this.subscribe(event, (data) => {
      callback(data);
      unsubscribe();
    });
  }
};

// Common theme events
// - cart:updated
// - product:added
// - search:open
// - search:close
// - mobileMenu:toggle
