"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { sl } from "@/lib/strings";

// Next 16: unstable_retry re-fetches and re-renders; reset() does neither on
// its own, so it's the weaker recovery path here — see version-16 docs.
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm text-muted-foreground">{sl.errors.unexpected}</p>
      <Button onClick={() => unstable_retry()}>Poskusi znova</Button>
    </div>
  );
}
