// NovAura Theme - Global JavaScript
// Cart functionality, mobile menu, and scroll animations

class NovAuraTheme {
  constructor() {
    this.cart = {
      items: [],
      total: 0
    };
    
    this.init();
  }
  
  init() {
    this.initCart();
    this.initMobileMenu();
    this.initScrollAnimations();
    this.initSmoothScroll();
  }
  
  // Cart functionality
  initCart() {
    const cartToggle = document.querySelector('[data-cart-toggle]');
    const cartDrawer = document.querySelector('.novaura-cart');
    
    if (cartToggle && cartDrawer) {
      cartToggle.addEventListener('click', () => {
        cartDrawer.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
      
      const closeBtn = cartDrawer.querySelector('.novaura-cart__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          cartDrawer.classList.remove('is-open');
          document.body.style.overflow = '';
        });
      }
      
      // Close on overlay click
      const overlay = document.querySelector('.novaura-cart__overlay');
      if (overlay) {
        overlay.addEventListener('click', () => {
          cartDrawer.classList.remove('is-open');
          document.body.style.overflow = '';
        });
      }
    }
    
    // Quick add buttons
    document.querySelectorAll('.novaura-product-card__quick-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const variantId = btn.dataset.productId;
        if (variantId) {
          this.addToCart(variantId);
        }
      });
    });
  }
  
  async addToCart(variantId, quantity = 1) {
    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: variantId,
          quantity: quantity
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        this.updateCartCount();
        this.showNotification('Added to cart!', 'success');
      } else {
        throw new Error(data.description || 'Failed to add to cart');
      }
    } catch (error) {
      console.error('Cart error:', error);
      this.showNotification(error.message, 'error');
    }
  }
  
  updateCartCount() {
    fetch('/cart.js')
      .then(res => res.json())
      .then(cart => {
        const countElements = document.querySelectorAll('[data-cart-count]');
        countElements.forEach(el => {
          el.textContent = cart.item_count;
          if (cart.item_count === 0) {
            el.classList.add('is-empty');
          } else {
            el.classList.remove('is-empty');
          }
        });
      });
  }
  
  // Mobile menu
  initMobileMenu() {
    const menuToggle = document.querySelector('[data-menu-toggle]');
    const mobileMenu = document.querySelector('.novaura-mobile-menu');
    
    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('is-open');
        menuToggle.classList.toggle('is-active');
      });
    }
  }
  
  // Scroll animations
  initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, observerOptions);
    
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
      observer.observe(el);
    });
  }
  
  // Smooth scroll
  initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }
  
  // Notification toast
  showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `novaura-toast novaura-toast--${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('is-visible');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
  window.novaura = new NovAuraTheme();
});

// Cart update listener
document.addEventListener('cart:updated', () => {
  if (window.novaura) {
    window.novaura.updateCartCount();
  }
});
