import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <AuthCard eyebrow="404" title="Nothing here">
      <p className="text-sm text-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className={buttonClass("ghost", "mt-6 w-full")}>
        Back to GuardRail
      </Link>
    </AuthCard>
  );
}
