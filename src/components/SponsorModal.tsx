import React, { useState } from 'react';
import { CheckCircle2, Megaphone, X } from 'lucide-react';

interface SponsorModalProps {
  open: boolean;
  onClose: () => void;
}

export const SponsorModal: React.FC<SponsorModalProps> = ({ open, onClose }) => {
  const [serverName, setServerName] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [tagline, setTagline] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim() || !serverIp.trim()) return;
    setSubmitted(true);
  };

  const resetAndClose = () => {
    setSubmitted(false);
    setServerName('');
    setServerIp('');
    setTagline('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sponsor-modal-title"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#111114] p-6 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Megaphone className="h-5 w-5 text-zinc-200" aria-hidden="true" />
            <div>
              <h2 id="sponsor-modal-title" className="text-base font-bold text-white">
                Sponsor SwxStudios Banner
              </h2>
              <p className="text-xs text-zinc-400">
                Featured weekly slot · $3.00 per Week
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close sponsor dialog"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>Slot reservation submitted</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-300">
              Your banner request for <strong>{serverName}</strong> ({serverIp}) has been queued for review.
            </p>
            <button
              type="button"
              onClick={resetAndClose}
              className="mt-4 h-9 rounded-md bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-zinc-200"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            <div>
              <label htmlFor="sponsor-name" className="block text-xs font-medium text-zinc-300">
                Server or Studio Name
              </label>
              <input
                id="sponsor-name"
                type="text"
                required
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="e.g. FrostSMP Network"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="sponsor-ip" className="block text-xs font-medium text-zinc-300">
                Server IP or Website URL
              </label>
              <input
                id="sponsor-ip"
                type="text"
                required
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="play.frostsmp.net"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="sponsor-tagline" className="block text-xs font-medium text-zinc-300">
                Banner Headline
              </label>
              <input
                id="sponsor-tagline"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="1.21.4 Custom Lifesteal Season 4 — Join Now"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetAndClose}
                className="h-9 rounded-md border border-zinc-800 px-3.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-md bg-white px-4 text-xs font-bold text-zinc-950 hover:bg-zinc-200"
              >
                Reserve Banner ($3/wk)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
