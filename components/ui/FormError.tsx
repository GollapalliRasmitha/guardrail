/** An error above a form's button. role="alert" makes screen readers read it as soon as it appears. */
export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="rounded-lg border border-sev-high/40 bg-sev-high/10 px-3 py-2 text-sm text-sev-high"
    >
      {message}
    </p>
  );
}
