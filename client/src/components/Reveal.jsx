import useInView from '../hooks/useInView';

const directionClass = {
  up: 'reveal--up',
  left: 'reveal--left',
  right: 'reveal--right',
  zoom: 'reveal--zoom',
};

/**
 * Scroll-reveal wrapper. Children fade/blur/slide in when scrolled into view.
 *
 * @example
 * <Reveal delay={120} direction="left" className="md:w-1/2">
 *   <p>...</p>
 * </Reveal>
 */
export default function Reveal({
  as: Tag = 'div',
  children,
  className = '',
  direction = 'up',
  delay = 0,
  threshold,
  rootMargin,
  style,
  ...rest
}) {
  const [ref, inView] = useInView({ threshold, rootMargin });

  return (
    <Tag
      ref={ref}
      className={`reveal ${directionClass[direction] || 'reveal--up'} ${inView ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
