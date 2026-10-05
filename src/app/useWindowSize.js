import { useState, useEffect, useMemo } from 'react';

// ─── useWindowSize ───
export function useWindowSize() {
  const getViewport = () => {
    if (typeof window === 'undefined') return { width: 1024, height: 768 };
    const viewport = window.visualViewport;
    return { width: Math.round(viewport?.width || window.innerWidth), height: Math.round(viewport?.height || window.innerHeight) };
  };
  const [size, setSize] = useState({
    ...getViewport(),
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;

    function handleResize() {
      if (!ticking) {
        const frame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
        frame(() => {
          const next = getViewport();
          document.documentElement.style.setProperty('--hz-viewport-width', `${next.width}px`);
          document.documentElement.style.setProperty('--hz-viewport-height', `${next.height}px`);
          setSize(next);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  const { width, height } = size;

  return useMemo(() => ({
    width,
    height,
    isMobile: width <= 640,
    isTablet: width > 640 && width <= 1024,
    isDesktop: width > 1024,
    isSmall: width <= 768,
  }), [width, height]);
}

// ─── useFullBleedStyle (Hook) ───
// استخدمه داخل المكون: const fullBleedStyle = useFullBleedStyle();
export function useFullBleedStyle() {
  const { isMobile, isTablet } = useWindowSize();

  return useMemo(() => ({
    width: '100%',
    maxWidth: '100%',
    minHeight: 0,
    boxSizing: 'border-box',
    overflowX: 'clip',
    borderRadius: '22px',
    padding: isMobile ? '12px' : isTablet ? '20px' : '30px',
  }), [isMobile, isTablet]);
}

// ─── fullBleedStyle (Object) ───
// للاستيراد المباشر بدون Hook: import { fullBleedStyle } from './useWindowSize';
export const fullBleedStyle = {
  width: '100%',
  maxWidth: '100%',
  minHeight: 0,
  boxSizing: 'border-box',
  overflowX: 'clip',
  borderRadius: '22px',
  padding: '0px',
};
