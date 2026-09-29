# What the GSAP showcase is built with

The gallery holds **494 sites**, not the 60 that load on first paint. It paginates behind a Load More control; this analysis exhausts it.

**Method.** The gallery is client-rendered, so it was driven headlessly: Load More exhausted to reach every card, plugin pills read straight from the DOM (they are masked, not removed), and each of the 13 category filters toggled to record membership. Then **151 sites** had their HTML and up to four JS bundles fetched and scanned for real GSAP call patterns, and **88 sites** — sampled evenly across the whole gallery rather than just the newest page — were rendered in a browser to measure computed colour and type.

## Plugin usage (all 494 sites, from the gallery's own tags)

| Plugin | Sites | Share |
| --- | ---: | ---: |
| ScrollTrigger | 426 | 86% |
| SplitText | 286 | 58% |
| Observer | 101 | 20% |
| Flip | 82 | 17% |
| ScrollSmoother | 66 | 13% |
| DrawSVG | 56 | 11% |
| Draggable | 43 | 9% |
| CustomEase | 39 | 8% |
| Inertia | 32 | 6% |
| MorphSVG | 26 | 5% |
| MotionPath | 26 | 5% |
| GSAP Core | 20 | 4% |
| ScrambleText | 16 | 3% |
| ScrollTo | 13 | 3% |
| useGSAP | 10 | 2% |
| Text | 8 | 2% |

**ScrollTrigger and SplitText are the showcase; everything else is a long tail.** Flip (16%) outranks both CustomEase (8%) and Draggable (9%).

## Category tags (a site can carry several)

| Tag | Sites | Share |
| --- | ---: | ---: |
| Scroll Animation | 432 | 87% |
| Text Animation | 390 | 79% |
| Web GL | 229 | 46% |
| Three.js | 206 | 42% |
| SVG Animation | 157 | 32% |
| Webflow | 129 | 26% |
| React | 111 | 22% |
| Reduced Motion | 93 | 19% |
| Portfolio | 61 | 12% |
| VueJS | 24 | 5% |
| UI Interactions | 19 | 4% |
| Astro | 12 | 2% |
| Svelte | 1 | 0% |

**Nearly half the gallery is 3D** — Web GL 46%, Three.js 42%. Only 19% carry the Reduced Motion tag.

## How they actually animate (source of 151 sites)

### Easing

| Ease | Occurrences |
| --- | ---: |
| `none` | 384 |
| `power2.out` | 278 |
| `power3.out` | 137 |
| `power2.inOut` | 131 |
| `expo.out` | 104 |
| `power3.inOut` | 94 |
| `power4.out` | 63 |
| `power1.out` | 62 |
| `expo.inOut` | 50 |
| `linear` | 28 |

`power2.out` is the default feel of the showcase. `none` ranks high because scrub-linked tweens require it, not because sites animate linearly. Names like `beaucoup.alpha` and `osmo` are site-specific CustomEase registrations, not shared idiom.

### Timing

- **Duration: median 0.50s**, mean 0.82s (n=2,126 literals). The cluster is 0.3s to 1.0s; the single most common value is `1`, then `0.5`, `0.4`, `0.3`.
- **Stagger: median 0.05s** (n=238). `0.05` and `0.1` dominate.

### ScrollTrigger

| `start` value | Occurrences |
| --- | ---: |
| `top bottom` | 51 |
| `top top` | 45 |
| `0% 100%` | 23 |
| `top 90%` | 21 |
| `top 85%` | 13 |
| `top bottom+=50px` | 12 |
| `bottom bottom` | 9 |
| `top 95%` | 8 |

`toggleActions: "play none none reverse"` is the only variant used more than once (18 occurrences).

| Technique | Share of sampled sites |
| --- | ---: |
| `gsap.matchMedia()` | 83% |
| `gsap.timeline()` | 42% |
| Lenis | 62% |
| `will-change` | 42% |
| Three.js / WebGL in bundle | 23% |
| `gsap.quickTo()` | 21% |
| ScrollTrigger `scrub` | 7% |
| ScrollTrigger `pin` | 4% |
| `gsap.context()` | 3% |

**The most useful finding: `scrub` appears in only 7% of sampled sites and `pin` in 4%.** ScrollTrigger is on 86% of the gallery, but the dominant use is a one-shot reveal as a section enters the viewport — not pinned, scrubbed, cinematic scroll. The showcase looks far more elaborate than its scroll code actually is.

`gsap.context()` at 3% is not neglect: `useGSAP()` and `matchMedia()` create contexts internally, so explicit use is largely obsolete.

## Measured in a browser (88 sites, evenly sampled)

- **Dark 43 (49%) vs light 43 (49%)**, 2 mid — effectively an even split.
- **h1 median 74px**, mean 99px, max 432px (n=52 with a display heading). 31 of 52 are 64px or larger; 17 of 52 are 90px or larger.
- **65 of 88 (74%) set a custom typeface on the h1.** Inter, Inter Tight, Aeonik, Neue Montreal, Geist, GT Walsheim and Neue Haas Grotesk recur.

## Corrections to earlier passes in this project

Several earlier estimates recorded in this repo were wrong. They are superseded by the numbers above.

| Claim | Earlier | Corrected | Why it was wrong |
| --- | --- | --- | --- |
| Gallery size | 60 sites | **494** | Load More was never exhausted, so only the first page was read. |
| Dark vs light | 73% light, then 65% dark | **~50/50** | The first counted hex literals in CSS; the second rendered only the 26 newest sites. |
| h1 median | 90px | **74px** | Same newest-first 26-site sample. |
| Custom typeface | 96% | **74%** | Same sampling bias. |
| CustomEase | 22% | **8%** | Visible pills only, and adjacent pill text was read concatenated (e.g. "ScrambleTextCustomEase"). |
| Draggable | 18% | **9%** | Same. |
| Observer | 32% | **20%** | Same. |
| Three.js | 28% | **42%** (gallery tag) | Bundle-string detection missed dynamically imported 3D. |

## What this project adopted, and why

- **Dark base.** Defensible either way at a 50/50 split; kept because the product is a security tool.
- **Type scale** `clamp(38px, 6.2vw, 86px)` — above the 74px median but inside the normal range, where a third of sites sit at 90px or more.
- **Inter + JetBrains Mono**, self-hosted at build time through `next/font`, matching the 74% that use a real typeface without adding a third-party request.
- **`power2.out` default, ~0.5s durations, 0.05–0.09s staggers, ScrollTrigger `start: "top 92%"`** — all land on the measured idiom.
- **`gsap.matchMedia()`**, which 83% of sampled sites use.
- **SplitText line reveal**, matching the 79% Text Animation tag.

Deliberately not adopted: **Lenis** (62%), because it replaces global scroll behaviour and interacts with both ScrollTrigger and the browser tests; and **scrub/pin**, which this data shows are rare in the showcase anyway.

## Data

`docs/data/all-sites.json` holds every site with its name, author, URL and plugin list. `docs/data/bytag.json` holds membership per category tag. Fetched page source and bundles were not retained.
