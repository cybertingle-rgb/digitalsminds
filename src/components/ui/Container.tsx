import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1680px] px-3 sm:px-5 md:px-14 ${className}`}>{children}</div>;
}
