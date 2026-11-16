import React from 'react';
import { NavTab } from '../types';

interface FooterProps {
  onSelectTab: (tab: NavTab) => void;
  onOpenSponsor: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab, onOpenSponsor }) => {
  return (
    <footer className="mt-16 border-t border-zinc-800/80 bg-[#09090b]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/Gemini_Generated_Image_m1vgo5m1vgo5m1vg_2bbe67cb.jpeg"
              alt="SwaxtuMC Studios logo"
              className="h-9 w-9 shrink-0 rounded-md border border-zinc-800 bg-black object-cover"
            />
            <span className="text-sm font-extrabold tracking-wider text-white uppercase">
              SWXSTUDIOS
            </span>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            Minecraft server plugins, models, configs, and verified setups.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-5 text-xs text-zinc-400">
          <button type="button" onClick={() => onSelectTab('home')} className="hover:text-white">
            Home
          </button>
          <button type="button" onClick={() => onSelectTab('downloads')} className="hover:text-white">
            Downloads
          </button>
          <button type="button" onClick={() => onSelectTab('exclusive')} className="hover:text-white">
            Exclusive
          </button>
          <button type="button" onClick={() => onSelectTab('community')} className="hover:text-white">
            Community
          </button>
          <button type="button" onClick={onOpenSponsor} className="hover:text-white">
            Advertise
          </button>
        </nav>

        <p className="text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} SwxStudios
        </p>
      </div>
    </footer>
  );
};
