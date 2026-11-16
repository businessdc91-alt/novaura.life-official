/**
 * SEOMeta Component
 * Dynamic meta tag management for NovAura
 * Handles document title, meta tags, Open Graph, Twitter Cards, and structured data
 */

import React, { useEffect, useCallback, type ReactElement } from 'react';
import type { SEOMetaProps } from '@/utils/seo';
import { DEFAULT_SEO } from '@/constants/seo';
import { mergeSEOMeta } from '@/utils/seo';

interface SEOMetaComponentProps extends SEOMetaProps {
  children?: React.ReactNode;
}

// Track meta elements created by this component for cleanup
const createdElements: HTMLMetaElement[] = [];
let currentTitle: string = '';
let currentCanonical: HTMLLinkElement | null = null;
let currentStructuredData: HTMLScriptElement | null = null;

/**
 * Update or create a meta tag
 */
function setMetaTag(name: string, content: string, property: boolean = false): void {
  if (!content) return;

  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.querySelector(selector) as HTMLMetaElement;

  if (!element) {
    element = document.createElement('meta');
    if (property) {
      element.setAttribute('property', name);
    } else {
      element.setAttribute('name', name);
    }
    document.head.appendChild(element);
    createdElements.push(element);
  }

  element.setAttribute('content', content);
}

/**
 * Update document title
 */
function setTitle(title: string): void {
  const fullTitle = title.includes(DEFAULT_SEO.siteName) 
    ? title 
    : `${title} | ${DEFAULT_SEO.siteName}`;
  
  document.title = fullTitle;
  currentTitle = fullTitle;
}

/**
 * Update canonical URL
 */
function setCanonical(url: string): void {
  if (currentCanonical) {
    currentCanonical.remove();
  }

  currentCanonical = document.createElement('link');
  currentCanonical.setAttribute('rel', 'canonical');
  currentCanonical.setAttribute('href', url);
  document.head.appendChild(currentCanonical);
}

/**
 * Update robots meta tag
 */
function setRobots(noindex: boolean): void {
  const content = noindex 
    ? 'noindex, nofollow' 
    : 'index, follow, max-image-preview:large, max-snippet:-1';
  setMetaTag('robots', content);
}

/**
 * Inject JSON-LD structured data
 */
function setStructuredData(data: Record<string, any> | undefined): void {
  if (currentStructuredData) {
    currentStructuredData.remove();
    currentStructuredData = null;
  }

  if (!data) return;

  currentStructuredData = document.createElement('script');
  currentStructuredData.setAttribute('type', 'application/ld+json');
  currentStructuredData.textContent = JSON.stringify(data, null, 2);
  document.head.appendChild(currentStructuredData);
}

/**
 * Clean up meta tags created by this component
 */
function cleanupMetaTags(): void {
  // Remove created meta elements
  createdElements.forEach(element => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
  createdElements.length = 0;

  // Remove canonical link
  if (currentCanonical) {
    currentCanonical.remove();
    currentCanonical = null;
  }

  // Remove structured data
  if (currentStructuredData) {
    currentStructuredData.remove();
    currentStructuredData = null;
  }
}

/**
 * SEOMeta Component
 * Manages all SEO-related meta tags and structured data
 */
export function SEOMeta({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  author,
  publishedAt,
  modifiedAt,
  noindex = false,
  canonical,
  locale = DEFAULT_SEO.locale,
  siteName = DEFAULT_SEO.siteName,
  twitterHandle = DEFAULT_SEO.twitterHandle,
  structuredData,
  children: _children,
}: SEOMetaComponentProps): null {
  const applyMetaTags = useCallback(() => {
    const meta = mergeSEOMeta({
      title,
      description,
      keywords,
      image,
      url,
      type,
      author,
      publishedAt,
      modifiedAt,
      noindex,
      canonical,
      structuredData,
    });

    // Set document title
    if (meta.title) {
      setTitle(meta.title);
    }

    // Basic meta tags
    if (meta.description) {
      setMetaTag('description', meta.description);
    }

    if (meta.keywords && meta.keywords.length > 0) {
      setMetaTag('keywords', meta.keywords.join(', '));
    }

    if (meta.author) {
      setMetaTag('author', meta.author);
    }

    // Robots tag
    setRobots(meta.noindex || false);

    // Canonical URL
    const canonicalUrl = meta.canonical || meta.url || window.location.href;
    setCanonical(canonicalUrl);

    // Open Graph tags
    setMetaTag('og:title', meta.title || DEFAULT_SEO.defaultTitle, true);
    setMetaTag('og:description', meta.description || DEFAULT_SEO.defaultDescription, true);
    setMetaTag('og:type', meta.type || 'website', true);
    setMetaTag('og:url', canonicalUrl, true);
    setMetaTag('og:site_name', siteName, true);
    setMetaTag('og:locale', locale, true);
    
    if (meta.image) {
      const imageUrl = meta.image.startsWith('http') 
        ? meta.image 
        : `${DEFAULT_SEO.siteUrl}${meta.image}`;
      setMetaTag('og:image', imageUrl, true);
      setMetaTag('og:image:width', '1200', true);
      setMetaTag('og:image:height', '630', true);
      setMetaTag('og:image:alt', meta.title || DEFAULT_SEO.defaultTitle, true);
    }

    if (meta.publishedAt) {
      setMetaTag('article:published_time', meta.publishedAt, true);
    }

    if (meta.modifiedAt) {
      setMetaTag('article:modified_time', meta.modifiedAt, true);
      setMetaTag('og:updated_time', meta.modifiedAt, true);
    }

    if (meta.author) {
      setMetaTag('article:author', meta.author, true);
    }

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:site', twitterHandle);
    setMetaTag('twitter:title', meta.title || DEFAULT_SEO.defaultTitle);
    setMetaTag('twitter:description', meta.description || DEFAULT_SEO.defaultDescription);
    
    if (meta.image) {
      const imageUrl = meta.image.startsWith('http') 
        ? meta.image 
        : `${DEFAULT_SEO.siteUrl}${meta.image}`;
      setMetaTag('twitter:image', imageUrl);
      setMetaTag('twitter:image:alt', meta.title || DEFAULT_SEO.defaultTitle);
    }

    if (meta.author) {
      setMetaTag('twitter:creator', `@${meta.author}`);
    }

    // Additional SEO meta tags
    setMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=5.0');
    setMetaTag('theme-color', DEFAULT_SEO.themeColor);
    setMetaTag('msapplication-TileColor', DEFAULT_SEO.themeColor);
    
    // Structured Data (JSON-LD)
    if (meta.structuredData) {
      setStructuredData(meta.structuredData);
    }
  }, [
    title,
    description,
    keywords,
    image,
    url,
    type,
    author,
    publishedAt,
    modifiedAt,
    noindex,
    canonical,
    locale,
    siteName,
    twitterHandle,
    structuredData,
  ]);

  useEffect(() => {
    // Apply meta tags on mount and updates
    applyMetaTags();

    // Cleanup on unmount
    return () => {
      // Note: We don't cleanup on unmount in SPA to prevent flickering
      // The next SEOMeta component will overwrite the tags
    };
  }, [applyMetaTags]);

  // This component doesn't render anything visible
  return null;
}

/**
 * SEOMetaProvider Component
 * Wraps children and provides SEO context if needed in the future
 */
export function SEOMetaProvider({ children }: { children: React.ReactNode }): ReactElement {
  // Clean up any leftover meta tags when the provider unmounts
  useEffect(() => {
    return () => {
      cleanupMetaTags();
    };
  }, []);

  return <>{children}</>;
}

/**
 * Hook to get current SEO state
 * Useful for debugging or dynamic updates
 */
export function useSEOMeta(): { title: string; url: string } {
  return {
    title: currentTitle,
    url: window.location.href,
  };
}

/**
 * Utility to preload critical SEO resources
 */
export function preloadSEOResources(): void {
  // Preconnect to external domains
  const preconnectDomains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ];

  preconnectDomains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

export default SEOMeta;
