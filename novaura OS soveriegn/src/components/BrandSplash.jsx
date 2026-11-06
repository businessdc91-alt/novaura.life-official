import React, { useCallback, useEffect, useRef, useState } from 'react';
import logoImg from '../assets/novaura-logo.png';
import studioLogo from '../assets/auraxnova-studios.jpg';
import { useGraphics, GRAPHICS_LEVELS } from '../contexts/GraphicsContext';
import './brandSplash.css';

// How long the card holds before it fades into the sign-in (ms).
const HOLD_MS = 7200;
const FADE_MS = 700;

/**
 * The title card after the boot screen: the NovAura mark as liquid light behind
 * everything, NovAura Systems Inc. and the edition on the left, Aura x Nova Studios
 * on the right, then "See you on the inside." Click or press a key to go on.
 */
export default function BrandSplash({ onComplete }) {
  const { graphicsLevel } = useGraphics();
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  const calm = graphicsLevel === GRAPHICS_LEVELS.LOW
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(() => completeRef.current?.(), FADE_MS);
  }, []);

  useEffect(() => {
    const timer = setTimeout(finish, HOLD_MS);
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [finish]);

  const at = (seconds) => ({ '--d': `${seconds}s` });
  const logoMask = { WebkitMaskImage: `url(${logoImg})`, maskImage: `url(${logoImg})` };

  return (
    <div className="nv-splash" data-leaving={leaving} data-calm={calm} onClick={finish} title="Click or press Enter to continue">
      {/* The liquid: animated noise displaces the logo, so its edges ripple like poured light. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="nv-liquid-filter" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.007 0.012" numOctaves="2" seed="7" result="noise">
            {!calm && <animate attributeName="baseFrequency" dur="9s" values="0.007 0.012;0.011 0.018;0.007 0.012" repeatCount="indefinite" />}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={calm ? 14 : 36} xChannelSelector="R" yChannelSelector="B" />
        </filter>
      </svg>
      <div className="nv-liquid" style={{ filter: 'url(#nv-liquid-filter)' }} aria-hidden="true">
        <img src={logoImg} alt="" draggable={false} />
        <div className="nv-liquid-sheen" style={logoMask} />
      </div>
      <div className="nv-vignette" />

      <div className="nv-skip-hint">CLICK OR PRESS ENTER</div>

      <div className="nv-inside" style={at(4.6)}>See you on the inside.</div>

      <div className="nv-credits">
        <div className="nv-company">
          <img src={logoImg} alt="NovAura" className="nv-company-logo nv-in" style={at(0.5)} draggable={false} />
          <h1 className="nv-company-name" style={at(0.9)}>NovAura Systems Inc.</h1>
          <div className="nv-tubes" aria-hidden="true">
            <div className="nv-tube nv-tube-cyan" style={at(1.9)} />
            <div className="nv-tube nv-tube-pink" style={at(2.05)} />
          </div>
          <div className="nv-edition-row">
            <svg className="nv-neon" viewBox="0 0 560 64" role="img" aria-label="NovAura Sovereign">
              <text x="2" y="52" textLength="552" lengthAdjust="spacingAndGlyphs" style={at(2.4)}>NovAura Sovereign</text>
            </svg>
            <span className="nv-edition" style={at(3.7)}>
              <span className="nv-edition-rgb nv-edition-glow" aria-hidden="true">Edition</span>
              <span className="nv-edition-rgb nv-edition-edge" aria-hidden="true">Edition</span>
              <span className="nv-edition-metal">Edition</span>
            </span>
          </div>
          <div className="nv-release nv-in" style={at(4.2)}>Release 2026</div>
        </div>

        <div className="nv-studio">
          <img src={studioLogo} alt="" className="nv-studio-logo nv-in" style={at(1.3)} draggable={false} />
          <div className="nv-studio-name nv-in" style={at(1.9)}>Aura x Nova Studios</div>
        </div>
      </div>
    </div>
  );
}
