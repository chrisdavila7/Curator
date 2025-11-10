import { InlineLoader } from "@/components/ui/inline-loader";

export default function Loading() {
  return (
    <div className="flex min-h-48 items-center justify-center py-8" aria-live="polite">
      <InlineLoader label="Loading dashboard…" size="md" />
    </div>
  );
}
