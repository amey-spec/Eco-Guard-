import { useEffect, useRef, useState } from 'react';
import useInView from '../hooks/useInView';

/**
 * Animated number that counts from 0 (or `from`) to `value`
 * once it scrolls into view. Used for premium stat reveals.
 */
export default function CountUp({
  value,
  from = 0,
  duration = 1600,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = ',',
  className = '',
}) {
  const [ref, inView] = useInView({ threshold: 0.4 });
  const [display, setDisplay] = useState(from);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return undefined;
    started.current = true;

    const start = performance.now();
    let raf;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutExpo for a premium decelerating count
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = from + (value - from) * eased;
      setDisplay(current);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, from, value, duration]);

  const formatted = Number(display).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted.replace(/,/g, separator)}
      {suffix}
    </span>
  );
}
