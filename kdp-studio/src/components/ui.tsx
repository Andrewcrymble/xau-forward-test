// Small reusable presentational components shared across the app.
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const buttonVariants = {
  primary:
    "bg-stone-900 text-white hover:bg-stone-700 disabled:bg-stone-300 disabled:text-stone-500",
  secondary:
    "bg-white text-stone-900 border border-stone-300 hover:bg-stone-100 disabled:text-stone-400",
  danger:
    "bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:text-red-300",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-xs text-stone-500">{hint}</span>
      )}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} min-h-20`} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputClass} {...props} />;
}

export function Checkbox({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 transition-colors hover:bg-stone-50">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-stone-900"
        {...props}
      />
      <span>
        <span className="block text-sm font-medium text-stone-800">{label}</span>
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      </span>
    </label>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
      <div
        className="h-full rounded-full bg-emerald-600 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-stone-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
