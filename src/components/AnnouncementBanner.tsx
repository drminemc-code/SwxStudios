import React from 'react';
import { ArrowRight, X } from 'lucide-react';

interface AnnouncementBannerProps {
  visible: boolean;
  label?: string;
  message?: string;
  onDismiss: () => void;
  onSeeExclusive: () => void;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  visible,
  label = 'Premium & Ultimate',
  message = 'Free, Paid, Popular, Premium, and Ultimate releases verified for Minecraft servers.',
  onDismiss,
  onSeeExclusive,
}) => {
  if (!visible) return null;

  return (
    <div className="border-b border-zinc-800/80 bg-[#0d0d11]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 text-zinc-300">
          <span className="shrink-0 font-semibold text-rose-400">{label}</span>
          <span aria-hidden="true" className="text-zinc-700">/</span>
          <p className="truncate text-zinc-400">{message}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onSeeExclusive}
            className="inline-flex items-center gap-1 font-semibold text-zinc-100 whitespace-nowrap transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <span>Explore</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss announcement"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
