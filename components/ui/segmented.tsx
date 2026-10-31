"use client";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { id: T; label: string; icon?: React.ReactNode }[];
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-[var(--r-md)] border border-line bg-panel p-0.5 ${className}`}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 rounded-[calc(var(--r-md)-3px)] px-2.5 py-1.5 text-[11.5px] font-medium transition-all ${
              active ? "bg-elev text-fg shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
