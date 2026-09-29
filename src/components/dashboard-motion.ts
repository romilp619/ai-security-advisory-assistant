'use client';
import type { RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

// Registered once. Neither call touches the DOM, so it is safe during server render.
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
gsap.defaults({ duration: 0.6, ease: 'power2.out' });

type Scope = RefObject<HTMLElement | null>;
type MotionState = {
  scope: Scope;
  /** Changes when a new research report arrives. */
  reportId: string | null;
  /** Changes when a new dependency report arrives. */
  dependencyId: string | null;
  activityCount: number;
  tab: string;
  busy: boolean;
};

/**
 * Every animation is wrapped in gsap.matchMedia() so that
 * `prefers-reduced-motion: reduce` collapses it to duration 0 rather than
 * leaving content hidden. Only transforms and opacity are animated.
 */
function motion(build: (reduced: boolean) => void) {
  const mm = gsap.matchMedia();
  // `base: 'all'` always matches, so the handler always runs; `reduced` then reports
  // which mode we are in. Registering only the `reduce` query would mean the handler
  // fired ONLY for users who asked for reduced motion, and never for anyone else.
  mm.add({ base: 'all', reduced: '(prefers-reduced-motion: reduce)' }, context => {
    build(Boolean(context.conditions?.reduced));
  });
  return () => mm.revert();
}
const secs = (reduced: boolean, value: number) => (reduced ? 0 : value);

export function useDashboardMotion({ scope, reportId, dependencyId, activityCount, tab, busy }: MotionState) {
  // ---- first paint: shell, hero, and the research form ----------------------
  useGSAP(() => motion(reduced => {
    const d = (value: number) => secs(reduced, value);
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.brand, .workspace-switch', { opacity: 0, x: -14, duration: d(0.5), stagger: d(0.07) })
      .from('.nav-label, .nav-item', { opacity: 0, x: -10, duration: d(0.4), stagger: d(0.045) }, d(0.15))
      .from('.sidebar-bottom > *', { opacity: 0, y: 12, duration: d(0.45), stagger: d(0.06) }, '<0.1')
      .from('.topbar', { opacity: 0, y: -10, duration: d(0.45) }, 0)
      .from('.welcome .eyebrow, .welcome p', { opacity: 0, y: 18, duration: d(0.6), stagger: d(0.08) }, d(0.1))
      .from('.welcome-symbol', { opacity: 0, scale: 0.86, rotate: -8, duration: d(0.8), ease: 'back.out(1.6)' }, '<0.1')
      .from('.connection-banner', { opacity: 0, y: 14, duration: d(0.5) }, '<0.15')
      .from('.research-panel', { opacity: 0, y: 22, duration: d(0.6) }, '<0.05')
      .from('.guide-panel', { opacity: 0, y: 22, duration: d(0.6) }, '<0.08')
      .from('.flow-list li', { opacity: 0, x: -10, duration: d(0.4), stagger: d(0.07) }, '<0.2');
  }), { scope });

  // ---- headline: per-line reveal, the showcase's most common text treatment ----
  useGSAP(() => motion(reduced => {
    const heading = document.querySelector<HTMLElement>('.welcome h1');
    if (!heading) return;
    if (reduced) return; // Reduced motion leaves the headline as plain, unsplit text.
    // autoSplit re-splits on reflow (font swap, resize) and onSplit re-runs the tween,
    // so the reveal survives the variable font loading in after first paint.
    const split = SplitText.create(heading, {
      type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'headline-line',
      onSplit: self => gsap.from(self.lines, {yPercent: 115, opacity: 0, duration: 0.85, stagger: 0.09, ease: 'power3.out'}),
    });
    return () => split.revert();
  }), { scope });

  // ---- below the fold: reveal on scroll, once -------------------------------
  useGSAP(() => motion(reduced => {
    if (reduced) return; // Nothing is hidden when motion is reduced.
    const reveal = (selector: string, vars: gsap.TweenVars = {}) => {
      const targets = gsap.utils.toArray<HTMLElement>(selector);
      if (!targets.length) return;
      gsap.from(targets, {
        opacity: 0, y: 24, duration: 0.55, ease: 'power2.out',
        stagger: 0.08, ...vars,
        scrollTrigger: { trigger: targets[0], start: 'top 92%', once: true },
      });
    };
    // A row of siblings must not stagger vertically: mid-reveal the cards read as
    // misaligned rather than sequenced. Sequence opacity and scale, keep tops locked.
    reveal('.examples button', { y: 0, scale: 0.975, transformOrigin: '50% 100%', stagger: 0.08, duration: 0.5 });
    reveal('.examples-heading', { y: 10 });
    reveal('.results-panel');
    reveal('.page-footer', { y: 12 });
  }), { scope });

  // ---- a new research report arrives ---------------------------------------
  useGSAP(() => {
    if (!reportId) return;
    return motion(reduced => {
      const d = (value: number) => secs(reduced, value);
      gsap.timeline({ defaults: { ease: 'power2.out' } })
        .from('.report-summary', { opacity: 0, y: 16, duration: d(0.5) })
        .from('.coverage-strip', { opacity: 0, y: 12, duration: d(0.45) }, '<0.08')
        .from('.finding-card', { opacity: 0, y: 20, duration: d(0.5), stagger: d(0.07) }, '<0.05')
        .from('.limitations', { opacity: 0, y: 14, duration: d(0.45) }, '<0.15');
    });
  }, { dependencies: [reportId], scope, revertOnUpdate: true });

  // ---- a new dependency report arrives -------------------------------------
  useGSAP(() => {
    if (!dependencyId) return;
    return motion(reduced => {
      const d = (value: number) => secs(reduced, value);
      gsap.timeline({ defaults: { ease: 'power2.out' } })
        .from('.dep-report .coverage-facts > div', { opacity: 0, y: 14, duration: d(0.45), stagger: d(0.06) })
        .from('.dep-item', { opacity: 0, y: 16, duration: d(0.45), stagger: d(0.05) }, '<0.1');
    });
  }, { dependencies: [dependencyId], scope, revertOnUpdate: true });

  // ---- streamed activity: only the newest row animates ----------------------
  useGSAP(() => {
    if (!activityCount) return;
    return motion(reduced => {
      const rows = gsap.utils.toArray<HTMLElement>('.activity-list li');
      const latest = rows[rows.length - 1];
      if (!latest) return;
      gsap.from(latest, { opacity: 0, x: -12, duration: secs(reduced, 0.4), ease: 'power2.out' });
    });
  }, { dependencies: [activityCount], scope });

  // ---- tab switches --------------------------------------------------------
  useGSAP(() => motion(reduced => {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    if (!panel) return;
    gsap.from(panel, { opacity: 0, y: 8, duration: secs(reduced, 0.35), ease: 'power2.out' });
  }), { dependencies: [tab], scope });

  // ---- running request: a slow breathing pulse on the status light ---------
  useGSAP(() => motion(reduced => {
    if (reduced || !busy) return;
    gsap.to('.status-light', { scale: 1.45, opacity: 0.55, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }), { dependencies: [busy], scope, revertOnUpdate: true });
}
