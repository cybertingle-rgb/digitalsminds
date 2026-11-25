/**
 * Soft brand-coloured lights drifting slowly behind the glass panels.
 * Pure CSS (transform-only animation); still on phones and for reduced motion.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
      <div className="dm-orb dm-orb-a -left-[12vw] -top-[18vh] h-[70vh] w-[70vh] bg-[radial-gradient(circle,rgb(255_116_31/0.2),rgb(255_116_31/0)_65%)]" />
      <div className="dm-orb dm-orb-b -right-[14vw] top-[10vh] h-[75vh] w-[75vh] bg-[radial-gradient(circle,rgb(255_214_186/0.32),rgb(255_214_186/0)_65%)]" />
      <div className="dm-orb dm-orb-c bottom-[-25vh] left-[25vw] h-[80vh] w-[80vh] bg-[radial-gradient(circle,rgb(255_116_31/0.14),rgb(255_116_31/0)_65%)]" />
      <div className="dm-orb dm-orb-b bottom-[5vh] -left-[10vw] h-[50vh] w-[50vh] bg-[radial-gradient(circle,rgb(17_17_17/0.06),rgb(17_17_17/0)_65%)]" />
      <div className="dm-orb dm-orb-a right-[20vw] top-[45vh] h-[45vh] w-[45vh] bg-[radial-gradient(circle,rgb(255_255_255/0.9),rgb(255_255_255/0)_65%)]" />
    </div>
  );
}
