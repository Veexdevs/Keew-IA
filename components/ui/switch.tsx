"use client";

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-40 ${
        checked ? "border-transparent bg-accent" : "border-line-strong bg-elev"
      }`}
    >
      <span
        className={`absolute top-[2px] size-[16px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );

  if (!label) return control;

  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-fg">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{hint}</p>}
      </div>
      {control}
    </div>
  );
}
