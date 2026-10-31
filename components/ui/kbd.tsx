export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[var(--r-xs)] border border-line bg-elev px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}
