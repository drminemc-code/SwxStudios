import React, { useState } from 'react';
import { Crown, LogIn, Menu, Search, Sparkles, X } from 'lucide-react';
import { DisplayIdentity, MembershipTier, NavTab } from '../types';

const LOGO_URL = '/assets/aistudio/Gemini_Generated_Image_m1vgo5m1vgo5m1vg_2bbe67cb.jpeg';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenSearch: () => void;
  onOpenPremium: () => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenAccount: () => void;
  identity: DisplayIdentity;
  isOwner: boolean;
  isPremium: boolean;
  membershipTier: MembershipTier;
  downloadCount: number;
}

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'community', label: 'Community' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'exclusive', label: 'Exclusive' },
  { id: 'levels', label: 'Levels' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSearch,
  onOpenPremium,
  onOpenAuth,
  onOpenAccount,
  identity,
  isOwner,
  isPremium,
  membershipTier,
  downloadCount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleNavItems = isOwner
    ? [...NAV_ITEMS, { id: 'admin' as NavTab, label: 'Admin' }]
    : NAV_ITEMS;

  const handleNav = (id: NavTab) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090b]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-2 px-3 sm:gap-6 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleNav('home');
          }}
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-md"
        >
          <img
            src={LOGO_URL}
            alt="SwaxtuMC Studios logo"
            className="h-9 w-9 shrink-0 rounded-md border border-zinc-800 bg-black object-cover"
          />
          <span className="text-xs sm:text-sm font-extrabold tracking-[0.06em] uppercase whitespace-nowrap">
            SWXSTUDIOS
          </span>
        </a>

        {/* Zone 2: Single-line navigation links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-5 lg:gap-6">
          {visibleNavItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                  active
                    ? 'text-white'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <span>{item.label}</span>
                {item.id === 'downloads' && downloadCount > 0 && (
                  <span className="ml-1.5 text-xs text-zinc-400 tabular-nums">
                    ({downloadCount})
                  </span>
                )}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-white"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Action Cluster */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Open quick search"
            className="hidden lg:inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Search</span>
            <kbd className="font-display-mono text-[11px] text-zinc-500">Ctrl K</kbd>
          </button>

          {identity.isSignedIn ? (
            <button
              type="button"
              onClick={onOpenAccount}
              aria-label="Open account and connected services"
              className="inline-flex h-8 max-w-[140px] items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/90 px-2.5 text-xs font-semibold text-zinc-100 whitespace-nowrap shrink-0 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {identity.avatarUrl ? (
                <img
                  src={identity.avatarUrl}
                  alt=""
                  className="h-5 w-5 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-white">
                  {identity.initials}
                </span>
              )}
              <span className="truncate">{identity.displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('signin')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/90 px-2.5 sm:px-3 text-xs font-semibold text-zinc-100 whitespace-nowrap shrink-0 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign In</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenPremium}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 sm:px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              membershipTier === 'ultimate'
                ? 'border border-violet-400/50 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25'
                : isPremium
                ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
                : 'bg-white text-zinc-950 hover:bg-zinc-200'
            }`}
          >
            {membershipTier === 'ultimate' ? (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {membershipTier === 'ultimate'
                ? 'Ultimate Active'
                : isPremium
                ? 'Premium Active'
                : 'Premium / Ultimate'}
            </span>
            <span className="sm:hidden">
              {membershipTier === 'ultimate' ? 'Ultimate' : isPremium ? 'Pro' : 'Plans'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-300 hover:bg-zinc-900 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-zinc-800 bg-[#09090b] px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {visibleNavItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                    active
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.id === 'downloads' && downloadCount > 0 && (
                    <span className="text-xs text-zinc-400 tabular-nums">{downloadCount} saved</span>
                  )}
                </button>
              );
            })}

            {!identity.isSignedIn ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signin');
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signup');
                  }}
                  className="rounded-md bg-white px-3 py-2 text-xs font-bold text-zinc-950"
                >
                  Sign Up
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAccount();
                }}
                className="mt-2 flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-xs font-semibold text-zinc-100"
              >
                <span>Account &amp; Connected Services</span>
                <span className="text-zinc-400">{identity.displayName}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSearch();
              }}
              className="mt-1 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2.5 text-sm text-zinc-300"
            >
              <Search className="h-4 w-4 text-zinc-400" aria-hidden="true" />
              <span>Quick search resources</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
