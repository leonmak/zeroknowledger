"use client";

import { useState, useEffect, useRef } from "react";

export default function Counter({ end, suffix = "" }) {
  const [c, setC] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const s = performance.now();
          const step = (now) => {
            const p = Math.min((now - s) / 2000, 1);
            setC(Math.floor((1 - Math.pow(1 - p, 3)) * end));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end]);
  return (
    <span ref={ref}>
      {c.toLocaleString()}
      {suffix}
    </span>
  );
}
