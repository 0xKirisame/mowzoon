import { useEffect, useRef } from 'react';

// macOS-style overlay scrollbar. Native scroll physics stay intact; this
// only draws the thumb, so it can stay slim at rest (including while
// scrolling) and thicken only on hover/drag. Works for the window/page or
// any inner scroll element. The native bar is hidden in CSS.

const INSET = 6;      // top/bottom breathing room for the track
const MIN_THUMB = 36; // never let the thumb shrink to a nub

// Wire a thumb element to a scroller (an Element, or `window` for the page).
function attach(scroller, bar, thumb) {
  const isWindow = scroller === window;
  const el = isWindow ? document.documentElement : scroller;
  let rafId = 0;
  let startY = 0;
  let startScroll = 0;

  const getTop = () => (isWindow ? window.scrollY : scroller.scrollTop);
  const setTop = (v) => { if (isWindow) window.scrollTo(0, v); else scroller.scrollTop = v; };

  const measure = () => {
    rafId = 0;
    const clientH = el.clientHeight;
    const scrollH = el.scrollHeight;
    const maxScroll = scrollH - clientH;
    if (maxScroll <= 1) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'block';
    const trackH = clientH - INSET * 2;
    const h = Math.max(MIN_THUMB, Math.round((clientH / scrollH) * trackH));
    const top = INSET + (maxScroll ? (getTop() / maxScroll) * (trackH - h) : 0);
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${Math.round(top)}px)`;
  };
  const schedule = () => { if (!rafId) rafId = requestAnimationFrame(measure); };

  const onMove = (e) => {
    const clientH = el.clientHeight;
    const scrollH = el.scrollHeight;
    const maxScroll = scrollH - clientH;
    const trackH = clientH - INSET * 2;
    const range = trackH - Math.max(MIN_THUMB, Math.round((clientH / scrollH) * trackH));
    setTop(startScroll + (range > 0 ? ((e.clientY - startY) / range) * maxScroll : 0));
  };
  const onUp = () => {
    bar.classList.remove('dragging');
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  const onDown = (e) => {
    e.preventDefault();
    startY = e.clientY;
    startScroll = getTop();
    bar.classList.add('dragging');
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const scrollTarget = isWindow ? window : scroller;
  thumb.addEventListener('pointerdown', onDown);
  scrollTarget.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  // Reshape when content or the container changes size. For the page we
  // watch the body (its height grows with content); for an element we watch
  // the box and its subtree (items added/removed change scrollHeight).
  const ro = new ResizeObserver(schedule);
  ro.observe(isWindow ? document.body : scroller);
  let mo;
  if (!isWindow) {
    mo = new MutationObserver(schedule);
    mo.observe(scroller, { childList: true, subtree: true, characterData: true });
  }

  measure();

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    thumb.removeEventListener('pointerdown', onDown);
    scrollTarget.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    ro.disconnect();
    if (mo) mo.disconnect();
  };
}

// Attach to a scroller. Pass the scroll element's ref, or omit for the page.
export function useOverlayScrollbar(barRef, thumbRef, scrollRef) {
  useEffect(() => {
    const scroller = scrollRef ? scrollRef.current : window;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!scroller || !bar || !thumb) return undefined;
    return attach(scroller, bar, thumb);
  }, [barRef, thumbRef, scrollRef]);
}

// The page (window) scrollbar.
export function PageScrollbar() {
  const barRef = useRef(null);
  const thumbRef = useRef(null);
  useOverlayScrollbar(barRef, thumbRef);
  return (
    <div ref={barRef} className="page-sb" aria-hidden="true">
      <div ref={thumbRef} className="page-sb-thumb" />
    </div>
  );
}

// Wraps scrollable content and overlays the same bar. Extra props (e.g.
// className) land on the scroll element itself.
export function ScrollArea({ className = '', children, ...rest }) {
  const scrollRef = useRef(null);
  const barRef = useRef(null);
  const thumbRef = useRef(null);
  useOverlayScrollbar(barRef, thumbRef, scrollRef);
  return (
    <div className="sa-wrap">
      <div ref={scrollRef} className={`sa-scroll ${className}`.trim()} {...rest}>
        {children}
      </div>
      <div ref={barRef} className="page-sb is-inner" aria-hidden="true">
        <div ref={thumbRef} className="page-sb-thumb" />
      </div>
    </div>
  );
}
