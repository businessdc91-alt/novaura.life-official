// NovAura Theme Constants
window.NovAura = window.NovAura || {};

NovAura.constants = {
  BREAKPOINTS: {
    mobile: 768,
    tablet: 1024,
    desktop: 1280
  },
  
  ANIMATION: {
    duration: {
      fast: 150,
      normal: 300,
      slow: 500
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    }
  },
  
  COLORS: {
    void: '#0a0a0f',
    voidLight: '#12121a',
    neonCyan: '#00f5d4',
    neonMagenta: '#ff006e',
    neonLime: '#39ff14',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0b0'
  }
};

NovAura.routes = {
  cartAdd: '/cart/add.js',
  cartChange: '/cart/change.js',
  cartUpdate: '/cart/update.js',
  cartGet: '/cart.js'
};
