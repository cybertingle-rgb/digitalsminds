import { getLogos } from "@/modules/content/settings";

/**
 * Neon logo preloader, shown once per browser session. Hidden by default in
 * CSS; PRELOADER_HEAD_SCRIPT switches it on for a first visit, and
 * PRELOADER_END_SCRIPT fades it out once the page has loaded (at least
 * ~0.9 s, at most 2.5 s). Without JavaScript it never appears.
 */
export const PRELOADER_HEAD_SCRIPT = `try{if(!sessionStorage.getItem("dm-seen")){sessionStorage.setItem("dm-seen","1");document.documentElement.classList.add("dm-preloading")}}catch(e){}`;

export const PRELOADER_END_SCRIPT = `(function(){var d=document.documentElement;if(!d.classList.contains("dm-preloading"))return;var t0=Date.now(),done=false;function end(){if(done)return;done=true;var el=document.getElementById("dm-preloader");if(el)el.classList.add("dm-done");setTimeout(function(){d.classList.remove("dm-preloading")},650)}function soon(){setTimeout(end,Math.max(0,900-(Date.now()-t0)))}if(document.readyState==="complete")soon();else window.addEventListener("load",soon);setTimeout(end,2500)})();`;

export async function Preloader({ label }: { label: string }) {
  const logo = (await getLogos()).light;
  return (
    <div id="dm-preloader" role="status" aria-label={label} className="fixed inset-0 z-[100] items-center justify-center overflow-hidden bg-[#fffdf5]">
      {/* Screen-filling neon glow */}
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgb(253_207_49/0.55),rgb(255_243_196/0.35)_30%,rgb(255_253_245/0)_70%)] [animation:dm-glow-pulse_1.8s_ease-in-out_infinite]" />
      <div aria-hidden="true" className="absolute h-[60vmin] w-[60vmin] rounded-full border-2 border-sun-400/70 shadow-[0_0_40px_rgb(253_207_49/0.8),inset_0_0_40px_rgb(253_207_49/0.6)] [animation:dm-glow-pulse_1.8s_ease-in-out_infinite]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.src} alt="" width={logo.width} height={logo.height} className="relative h-auto w-[min(60vw,320px)] [animation:dm-neon_1.8s_ease-in-out_infinite]" />
    </div>
  );
}
