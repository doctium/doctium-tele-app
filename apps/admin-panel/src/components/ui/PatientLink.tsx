import Link from "next/link";
import clsx from "clsx";

/**
 * Patient name → their details page (/users/:id), used everywhere a patient
 * appears in a table or card. Pointer cursor + underline affordance on hover;
 * falls back to plain text when no id is available.
 */
export function PatientLink({
  id,
  name,
  className,
}: {
  id?: string | null;
  name?: string | null;
  className?: string;
}) {
  const label = name || "—";
  if (!id) return <span className={className}>{label}</span>;
  return (
    <Link
      href={`/users/${id}`}
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        "cursor-pointer transition-colors hover:text-teal-600 hover:underline underline-offset-2",
        className,
      )}
    >
      {label}
    </Link>
  );
}
