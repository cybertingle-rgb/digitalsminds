/** Forward arrow that points the reading direction (flips in right-to-left pages). */
export function Arrow({ back = false }: { back?: boolean }) {
  return (
    <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
      {back ? "←" : "→"}
    </span>
  );
}
