import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { NavTab } from '../types';

interface FooterProps {
  onSelectTab: (tab: NavTab) => void;
  onOpenSponsor: () => void;
  verifyRayId?: string | null;
  onResetBotVerify?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectTab,
  onOpenSponsor,
  verifyRayId,
  onResetBotVerify,
}) => {
  return (
    <footer className="mt-16 border-t border-zinc-800/80 bg-[#08080a]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/brand/swx-emblem.jpg"
              alt="SwxStudios logo"
              className="h-9 w-9 shrink-0 rounded-md border border-zinc-800 bg-black object-cover"
            />
            <span className="text-sm font-extrabold tracking-wider text-white uppercase">
              SWXSTUDIOS
            </span>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            Minecraft plugins, maps, configs, and server tools.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-5 text-xs text-zinc-400">
          <button type="button" onClick={() => onSelectTab('home')} className="hover:text-rose-300">
            Home
          </button>
          <button type="button" onClick={() => onSelectTab('tools')} className="hover:text-rose-300">
            Tools
          </button>
          <button type="button" onClick={() => onSelectTab('servers')} className="hover:text-rose-300">
            Servers
          </button>
          <button type="button" onClick={() => onSelectTab('tiers')} className="hover:text-amber-300">
            Tier List
          </button>
          <button type="button" onClick={() => onSelectTab('ranks')} className="hover:text-indigo-300">
            Ranks &amp; Friends
          </button>
          <button type="button" onClick={() => onSelectTab('stats')} className="hover:text-rose-300">
            Site Stats
          </button>
          <button type="button" onClick={() => onSelectTab('guides')} className="hover:text-rose-300">
            Guides
          </button>
          <button type="button" onClick={() => onSelectTab('downloads')} className="hover:text-rose-300">
            Downloads
          </button>
          <button type="button" onClick={() => onSelectTab('exclusive')} className="hover:text-rose-300">
            Exclusive
          </button>
          <button type="button" onClick={() => onSelectTab('community')} className="hover:text-rose-300">
            Community
          </button>
          <button type="button" onClick={onOpenSponsor} className="hover:text-rose-300">
            Advertise
          </button>
        </nav>

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          {onResetBotVerify && (
            <button
              type="button"
              onClick={onResetBotVerify}
              title={verifyRayId ? `Ray ID: ${verifyRayId}` : 'Re-run anti-bot check'}
              className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-display-mono text-[11px] text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-zinc-200"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>SwxShield Check</span>
            </button>
          )}
          <p>&copy; {new Date().getFullYear()} SwxStudios</p>
        </div>
      </div>
    </footer>
  );
};
