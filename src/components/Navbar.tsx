import React, { useEffect } from 'react';
import {
  BarChart3,
  BookOpen,
  Compass,
  Crown,
  Download,
  Home,
  LogIn,
  Medal,
  Menu,
  MessageSquare,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wrench,
  X,
} from 'lucide-react';
import { DisplayIdentity, MembershipTier, NavTab } from '../types';
import { MinecraftHeadAvatar } from './MinecraftHeadAvatar';
import { TOOL_DIRECTORY } from './ToolsView';

const LOGO_URL = '/assets/aistudio/Gemini_Generated_Image_m1vgo5m1vgo5m1vg_2bbe67cb.jpeg';

interface NavbarProps {
  activeTab: NavTab;
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  onToggleSidebar: () => void;
  onCloseMobileDrawer: () => void;
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
  pendingFriendRequestsCount?: number;
}

const NAV_ITEMS: { id: NavTab; label: string; group: 'platform' | 'resources' }[] = [
  { id: 'home', label: 'Home', group: 'platform' },
  { id: 'tools', label: 'Tools', group: 'platform' },
  { id: 'servers', label: 'Servers', group: 'platform' },
  { id: 'tiers', label: 'Tier List', group: 'platform' },
  { id: 'ranks', label: 'Ranks & Friends', group: 'platform' },
  { id: 'stats', label: 'Studio Stats', group: 'platform' },
  { id: 'guides', label: 'Guides', group: 'platform' },
  { id: 'downloads', label: 'Downloads', group: 'resources' },
  { id: 'exclusive', label: 'Exclusive', group: 'resources' },
  { id: 'community', label: 'Community', group: 'resources' },
  { id: 'levels', label: 'Levels', group: 'resources' },
];

function navItemIcon(id: NavTab) {
  switch (id) {
    case 'home':
      return <Home className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'tools':
      return <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'servers':
      return <Server className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'tiers':
      return <Medal className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'ranks':
      return <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'stats':
      return <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'guides':
      return <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'downloads':
      return <Download className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'exclusive':
      return <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'community':
      return <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'levels':
      return <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'admin':
      return <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />;
  }
}

export const Navbar: React.FC<NavbarProps> = ({
  sidebarCollapsed,
  mobileDrawerOpen,
  onToggleSidebar,
  onSelectTab,
  onOpenSearch,
  onOpenPremium,
  onOpenAuth,
  onOpenAccount,
  identity,
  isPremium,
  membershipTier,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#08080a]/95 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between gap-1.5 px-2.5 sm:gap-4 sm:px-5">
        {/* Zone 1: Clickable 3-Line Menu Trigger + Brand Wordmark */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={
              mobileDrawerOpen
                ? 'Close navigation menu'
                : sidebarCollapsed
                ? 'Expand sidebar menu'
                : 'Toggle sidebar menu'
            }
            aria-expanded={mobileDrawerOpen || !sidebarCollapsed}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/90 text-zinc-200 transition-colors hover:border-rose-500/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('home');
            }}
            className="flex shrink-0 items-center gap-2 sm:gap-2.5 whitespace-nowrap rounded-md text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
          >
            <img
              src={LOGO_URL}
              alt="SwaxtuMC Studios logo"
              className="h-8 w-8 shrink-0 rounded-md border border-zinc-800 bg-black object-cover"
            />
            <span className="font-display text-xs sm:text-sm font-extrabold uppercase tracking-[0.06em] whitespace-nowrap">
              SWXSTUDIOS
            </span>
          </a>
        </div>

        {/* Zone 2: Centered Quick Search Bar on Tablet/Desktop */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open quick search"
          className="hidden sm:flex h-9 w-full max-w-md items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/90 px-3 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
            <span className="truncate">Search plugins, tools, servers...</span>
          </span>
          <kbd className="font-display-mono shrink-0 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400">
            Ctrl K
          </kbd>
        </button>

        {/* Zone 3: Action Cluster */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search"
            className="inline-flex sm:hidden h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {identity.isSignedIn ? (
            <button
              type="button"
              onClick={onOpenAccount}
              aria-label="Open account and connected services"
              className="inline-flex h-8 max-w-[140px] items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/90 px-2.5 text-xs font-semibold text-zinc-100 whitespace-nowrap shrink-0 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <MinecraftHeadAvatar
                avatarUrl={identity.avatarUrl}
                alt=""
                initials={identity.initials}
                className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-zinc-950"
              />
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
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 sm:px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 ${
              membershipTier === 'ultimate'
                ? 'border border-violet-400/50 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25'
                : isPremium
                ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
                : 'bg-rose-600 text-white hover:bg-rose-500'
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
        </div>
      </div>
    </header>
  );
};

interface WorkspaceSidebarProps {
  activeTab: NavTab;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectTab: (tab: NavTab) => void;
  onOpenSearch: () => void;
  onOpenPremium: () => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenAccount: () => void;
  identity: DisplayIdentity;
  isOwner: boolean;
  downloadCount: number;
  pendingFriendRequestsCount?: number;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeTab,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onSelectTab,
  onOpenSearch,
  onOpenPremium,
  onOpenAuth,
  onOpenAccount,
  identity,
  isOwner,
  downloadCount,
  pendingFriendRequestsCount = 0,
}) => {
  const visibleNavItems = isOwner
    ? [...NAV_ITEMS, { id: 'admin' as NavTab, label: 'Admin Panel', group: 'resources' as const }]
    : NAV_ITEMS;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const handleNav = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const renderSidebarLinks = (isCompact: boolean) => (
    <div className="flex h-full flex-col justify-between p-3">
      <div className="space-y-5">
        {/* Platform Group */}
        <div>
          {!isCompact && (
            <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Platform
            </p>
          )}
          <nav aria-label="Workspace platform" className="mt-1.5 space-y-1">
            {visibleNavItems
              .filter((item) => item.group === 'platform')
              .map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={isCompact ? item.label : undefined}
                    onClick={() => handleNav(item.id)}
                    className={`flex w-full items-center ${
                      isCompact ? 'justify-center px-2' : 'justify-between px-2.5'
                    } rounded-md py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'border border-rose-500/40 bg-rose-600/15 text-white'
                        : 'border border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={active ? 'text-rose-400' : 'text-zinc-400'}>
                        {navItemIcon(item.id)}
                      </span>
                      {!isCompact && <span>{item.label}</span>}
                    </span>
                    {!isCompact && item.id === 'tools' && (
                      <span className="font-display-mono text-[10px] text-rose-400 tabular-nums">
                        {TOOL_DIRECTORY.length}
                      </span>
                    )}
                    {!isCompact && item.id === 'ranks' && pendingFriendRequestsCount > 0 && (
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 font-display-mono text-[10px] font-bold text-white tabular-nums">
                        {pendingFriendRequestsCount}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

        {/* Resources & Community Group */}
        <div>
          {!isCompact && (
            <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Resources
            </p>
          )}
          <nav aria-label="Workspace resources" className="mt-1.5 space-y-1">
            {visibleNavItems
              .filter((item) => item.group === 'resources')
              .map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={isCompact ? item.label : undefined}
                    onClick={() => handleNav(item.id)}
                    className={`flex w-full items-center ${
                      isCompact ? 'justify-center px-2' : 'justify-between px-2.5'
                    } rounded-md py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'border border-rose-500/40 bg-rose-600/15 text-white'
                        : 'border border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={active ? 'text-rose-400' : 'text-zinc-400'}>
                        {navItemIcon(item.id)}
                      </span>
                      {!isCompact && <span>{item.label}</span>}
                    </span>
                    {!isCompact && item.id === 'downloads' && downloadCount > 0 && (
                      <span className="font-display-mono text-[10px] text-rose-400 tabular-nums">
                        {downloadCount}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>
      </div>

      {/* Bottom Membership + Account Box */}
      <div className="mt-6 space-y-2 border-t border-zinc-800/80 pt-3">
        {!isCompact ? (
          <>
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                onOpenPremium();
              }}
              className="flex w-full items-center justify-between rounded-md border border-rose-500/35 bg-rose-600/10 px-3 py-2.5 text-left transition-colors hover:bg-rose-600/20"
            >
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Compass className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                  <span>Premium &amp; Ultimate</span>
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  Unlock paid &amp; exclusive builds
                </p>
              </div>
            </button>

            {!identity.isSignedIn ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onOpenAuth('signin');
                  }}
                  className="h-8 rounded-md border border-zinc-700 bg-zinc-900 text-[11px] font-semibold text-zinc-100 hover:border-zinc-500"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onOpenAuth('signup');
                  }}
                  className="h-8 rounded-md bg-rose-600 text-[11px] font-bold text-white hover:bg-rose-500"
                >
                  Sign Up
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onOpenAccount();
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] font-semibold text-zinc-100 hover:border-zinc-600"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MinecraftHeadAvatar
                    avatarUrl={identity.avatarUrl}
                    alt=""
                    initials={identity.initials}
                    className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-zinc-950"
                  />
                  <span>Account</span>
                </span>
                <span className="max-w-[96px] truncate text-rose-300">
                  {identity.displayName}
                </span>
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            title="Premium & Ultimate Plans"
            onClick={onOpenPremium}
            className="flex h-9 w-full items-center justify-center rounded-md border border-rose-500/40 bg-rose-600/15 text-rose-300 hover:bg-rose-600/25"
          >
            <Crown className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Docked Collapsible Workspace Sidebar (toggled by 3-line trigger) */}
      <aside
        aria-label="Desktop workspace navigation"
        className={`hidden lg:flex shrink-0 flex-col border-r border-zinc-800/80 bg-[#0a0a0d] transition-all duration-200 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {renderSidebarLinks(collapsed)}
      </aside>

      {/* Mobile / Tablet Slide-over Navigation Drawer (toggled by 3-line trigger) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close menu backdrop"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          />

          <aside
            aria-label="Mobile workspace drawer"
            className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-zinc-800 bg-[#0b0b0f] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={LOGO_URL}
                  alt="SwaxtuMC Studios logo"
                  className="h-8 w-8 rounded-md border border-zinc-800 bg-black object-cover"
                />
                <div>
                  <p className="font-display text-xs font-extrabold uppercase tracking-wider text-white">
                    SWXSTUDIOS
                  </p>
                  <p className="text-[10px] font-medium text-rose-400">
                    Tools, Servers &amp; Releases
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close drawer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-rose-500/60 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onOpenSearch();
                }}
                className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:border-rose-500/60 hover:text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                  <span>Quick Search</span>
                </span>
                <kbd className="font-display-mono text-[10px] text-zinc-500">Ctrl K</kbd>
              </button>
            </div>

            <div className="flex-1">{renderSidebarLinks(false)}</div>
          </aside>
        </div>
      )}
    </>
  );
};
