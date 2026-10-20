"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** If a dashboard page fails, show this inside the shell instead of a blank screen. No error details leak. */
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={<TriangleAlert className="size-6" />}
      title="This page couldn't load"
      action={<Button onClick={reset}>Try again</Button>}
    >
      Something went wrong while loading. Check that the database is running, then try again.
    </EmptyState>
  );
}
