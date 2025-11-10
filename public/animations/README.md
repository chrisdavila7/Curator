Place your Lottie overlay JSON here.

Recommended filename:
- overlay.json

Why public/animations?
- Performance: keeps large JSON out of JS bundles and loads on demand via fetch.
- Reliability: assets are served statically by Next.js from /public with cache control.

How to wire the file:
- Move or copy your Lottie file (e.g., "Scene-1 (6).json") to:
  my-app/public/animations/overlay.json

- The sidebar Overlay button calls:
  open({ url: "/animations/overlay.json", loop: false, autoplay: true })

Notes:
- If users prefer reduced motion, autoplay/loop are disabled by default (can be overridden).
- If the file is missing or fails to load, the overlay will not open and an error is logged to the console.
- You can choose a different name/URL, but also update the call site in AppSidebar:
  src/components/app-sidebar.tsx (onPlayOverlay)
