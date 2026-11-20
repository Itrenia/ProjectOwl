"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy scan entry point, kept only as a redirect.
 *
 * Scanning now lives inside the Add Expense composer (/transactions/new),
 * which owns the full flow — upload, loader with cancel, item assignment,
 * save. Nothing in the app links here any more, and the old standalone page
 * was a dead end: a full-screen uploader with no back button, outside the
 * shell's navigation (#69). Any stale link or bookmark lands in the composer
 * instead.
 */
export default function ScanPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/transactions/new");
  }, [router]);

  return null;
}
