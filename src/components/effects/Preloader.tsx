import type { CSSProperties, ReactNode } from "react";
import { getLogos } from "@/modules/content/settings";

/**
 * Brand preloader, shown once per browser session: the official logo inside
 * a slowly turning orbit of learning and business icons (books, notebook,
 * pen, pencil, notes, lightbulb, graduation cap, chart, ruler) that emerge
 * from the logo, with a few rising sparks.
 *
 * Hidden by default in CSS; PRELOADER_HEAD_SCRIPT switches it on for a first
 * visit, and PRELOADER_END_SCRIPT fades it out once the page has loaded (at
 * least ~1.1 s, at most 2.8 s, whatever happens to the requests). Without
 * JavaScript it never appears. Only transforms and opacity are animated, and
 * with prefers-reduced-motion everything holds still (see globals.css).
 */
export const PRELOADER_HEAD_SCRIPT = `try{if(!sessionStorage.getItem("dm-seen")){sessionStorage.setItem("dm-seen","1");document.documentElement.classList.add("dm-preloading")}}catch(e){}`;

export const PRELOADER_END_SCRIPT = `(function(){var d=document.documentElement;if(!d.classList.contains("dm-preloading"))return;var t0=Date.now(),done=false;function end(){if(done)return;done=true;var el=document.getElementById("dm-preloader");if(el)el.classList.add("dm-done");setTimeout(function(){d.classList.remove("dm-preloading")},650)}function soon(){setTimeout(end,Math.max(0,1100-(Date.now()-t0)))}if(document.readyState==="complete")soon();else window.addEventListener("load",soon);setTimeout(end,2800)})();`;

const INK = "#2b323c";
const SUN = "#fdcf31";

/** 24×24 line icons in the brand's charcoal with a yellow accent. */
const ICONS: { name: string; svg: ReactNode }[] = [
  {
    name: "book",
    svg: (
      <>
        <path d="M3 5.5C3 4.7 3.7 4 4.5 4H10c1.1 0 2 .9 2 2v13c0-.8-.7-1.5-1.5-1.5h-6c-.8 0-1.5-.7-1.5-1.5V5.5Z" fill={SUN} fillOpacity=".35" />
        <path d="M21 5.5c0-.8-.7-1.5-1.5-1.5H14c-1.1 0-2 .9-2 2v13c0-.8.7-1.5 1.5-1.5h6c.8 0 1.5-.7 1.5-1.5V5.5Z" />
        <path d="M3 5.5C3 4.7 3.7 4 4.5 4H10c1.1 0 2 .9 2 2v13c0-.8-.7-1.5-1.5-1.5h-6c-.8 0-1.5-.7-1.5-1.5V5.5Z" />
      </>
    ),
  },
  {
    name: "lightbulb",
    svg: (
      <>
        <path d="M9 17.5h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" fill={SUN} fillOpacity=".55" />
        <path d="M12 7v3M10.5 9.5 12 11l1.5-1.5" />
      </>
    ),
  },
  {
    name: "graduation cap",
    svg: (
      <>
        <path d="m2 9 10-5 10 5-10 5L2 9Z" fill={SUN} fillOpacity=".45" />
        <path d="M6 11v4.5c0 1.4 2.7 3 6 3s6-1.6 6-3V11M22 9v6" />
      </>
    ),
  },
  {
    name: "pencil",
    svg: (
      <>
        <path d="M14.5 4.5 19.5 9.5 9 20H4v-5L14.5 4.5Z" fill={SUN} fillOpacity=".4" />
        <path d="m12.5 6.5 5 5M4 15l5 5" />
      </>
    ),
  },
  {
    name: "chart",
    svg: (
      <>
        <path d="M4 20V4M4 20h16" />
        <path d="M8 16v-4M12 16V9M16 16v-6" stroke={SUN} strokeWidth="2.6" />
        <path d="m7 9 4-3 3 2 5-4" />
      </>
    ),
  },
  {
    name: "notebook",
    svg: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" fill={SUN} fillOpacity=".3" />
        <path d="M3 7h4M3 12h4M3 17h4M10 8h6M10 12h6" />
      </>
    ),
  },
  {
    name: "pen",
    svg: (
      <>
        <path d="M15 3.5a2.1 2.1 0 0 1 3 3L8 16.5 4 18l1.5-4L15 3.5Z" />
        <path d="m13 5.5 3 3" />
        <path d="M4 21h9" stroke={SUN} strokeWidth="2.4" />
      </>
    ),
  },
  {
    name: "notes",
    svg: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5" fill={SUN} fillOpacity=".6" />
        <path d="M9 13h6M9 17h4" />
      </>
    ),
  },
  {
    name: "ruler",
    svg: (
      <>
        <rect x="2.5" y="8" width="19" height="8" rx="1.5" transform="rotate(-30 12 12)" fill={SUN} fillOpacity=".35" />
        <path d="m7.6 13.6 1.3 2.2M10.6 11.9l.8 1.4M13.6 10.1l1.3 2.2M16.6 8.4l.8 1.4" />
      </>
    ),
  },
];

const SPARKS = 7;

export async function Preloader({ label }: { label: string }) {
  const logo = (await getLogos()).light;
  return (
    <div id="dm-preloader" role="status" aria-label={label} className="fixed inset-0 z-[100] items-center justify-center overflow-hidden bg-[#fffdf5]">
      {/* Soft sunlight behind the logo */}
      <div aria-hidden="true" className="dm-pl-glow absolute h-[80vmin] w-[80vmin] rounded-full bg-[radial-gradient(circle,rgb(253_207_49/0.38),rgb(255_243_196/0.2)_42%,rgb(255_253_245/0)_70%)]" />

      <div aria-hidden="true" className="dm-pl-stage relative">
        {/* Orbit paths: a fine dashed track and a turning yellow arc */}
        <svg className="dm-pl-track absolute inset-0 h-full w-full" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="96" stroke={INK} strokeOpacity=".14" strokeWidth=".6" strokeDasharray="1.5 4" />
        </svg>
        <svg className="dm-pl-arc absolute inset-0 h-full w-full" viewBox="0 0 200 200" fill="none">
          <defs>
            <linearGradient id="dm-pl-arc-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={SUN} stopOpacity="0" />
              <stop offset="1" stopColor={SUN} />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="70" stroke="url(#dm-pl-arc-g)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="120 320" />
          <circle cx="100" cy="100" r="70" stroke={INK} strokeOpacity=".08" strokeWidth=".6" />
        </svg>

        {/* Icons on the outer orbit; each emerges from the centre, then the ring turns while they stay upright */}
        <div className="dm-pl-orbit absolute inset-0">
          {ICONS.map((icon, i) => (
            <span key={icon.name} className="dm-pl-slot absolute left-1/2 top-1/2" style={{ "--a": `${(360 / ICONS.length) * i}deg`, "--i": i } as CSSProperties}>
              <span className="dm-pl-icon flex items-center justify-center rounded-2xl bg-white/90 shadow-[0_6px_18px_-6px_rgb(43_50_60/0.35)] ring-1 ring-white">
                <svg viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[55%] w-[55%]">
                  {icon.svg}
                </svg>
              </span>
            </span>
          ))}
        </div>

        {/* Sparks rising from the logo */}
        {Array.from({ length: SPARKS }, (_, i) => (
          <span key={i} className="dm-pl-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-sun-400" style={{ "--s": `${(360 / SPARKS) * i + 20}deg`, "--i": i } as CSSProperties} />
        ))}

        {/* The official logo */}
        <div className="absolute inset-[26%] flex items-center justify-center rounded-full bg-white/80 shadow-[0_10px_40px_-12px_rgb(43_50_60/0.35),inset_0_0_0_1px_rgb(255_255_255)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.src} alt="" width={logo.width} height={logo.height} className="dm-pl-logo h-auto w-[78%]" />
        </div>
      </div>
    </div>
  );
}
