import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Track page view on route change
    if (typeof window.gtag === 'function') {
      window.gtag('config', 'G-JXSHZN0FT0', {
        page_path: pathname + search,
      });
    }
  }, [pathname, search]);

  return null;
}
