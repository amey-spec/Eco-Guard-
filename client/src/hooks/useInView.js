import { useEffect, useRef, useState } from 'react';

/**
 * Observes an element and reports when it enters the viewport.
 * Used to drive scroll-reveal animations across the site.
 *
 * @param {Object}   options
 * @param {number}   [options.threshold=0.15] - fraction of element visible before firing
 * @param {string}   [options.rootMargin='0px 0px -8% 0px'] - expands/shrinks the root
 * @param {boolean}  [options.once=true] - only fire the first time
 * @returns {[import('react').RefObject, boolean]}
 */
export default function useInView({ threshold = 0.15, rootMargin = '0px 0px -8% 0px', once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setInView(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView];
}
