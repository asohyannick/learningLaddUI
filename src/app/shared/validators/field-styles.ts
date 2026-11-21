const BASE =
  'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:opacity-60';

/** Tailwind classes for a text input: red border and ring when the field shows an error. */
export function inputClasses(invalid: boolean): string {
  return invalid
    ? `${BASE} border-red-500 focus:border-red-500 focus:ring-red-100`
    : `${BASE} border-line focus:border-royal focus:ring-royal-soft`;
}
