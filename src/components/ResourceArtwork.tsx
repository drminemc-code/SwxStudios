import React from 'react';
import {
  Bot,
  Box,
  Code2,
  Cpu,
  Flame,
  Layers,
  Map,
  Monitor,
  SlidersHorizontal,
} from 'lucide-react';
import { ArtworkTheme, CategoryId } from '../types';

export const HeroVoxelBackdrop: React.FC = () => (
  <svg
    viewBox="0 0 1200 420"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 h-full w-full opacity-55"
  >
    <defs>
      <radialGradient id="heroDepth" cx="82%" cy="18%" r="65%">
        <stop offset="0%" stopColor="#27272a" stopOpacity="0.45" />
        <stop offset="60%" stopColor="#111114" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#09090b" stopOpacity="0" />
      </radialGradient>
      <pattern id="studioGrid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path
          d="M 32 0 L 0 0 0 32"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.035"
          strokeWidth="1"
        />
      </pattern>
    </defs>
    <rect width="1200" height="420" fill="url(#studioGrid)" />
    <rect width="1200" height="420" fill="url(#heroDepth)" />
  </svg>
);

export const CategoryVoxelIcon: React.FC<{ category: CategoryId }> = ({ category }) => {
  const iconClass = 'h-4 w-4 shrink-0';
  switch (category) {
    case 'plugins':
      return <Box className={`${iconClass} text-amber-400`} aria-hidden="true" />;
    case 'configs':
      return <SlidersHorizontal className={`${iconClass} text-zinc-300`} aria-hidden="true" />;
    case 'setups':
      return <Cpu className={`${iconClass} text-sky-400`} aria-hidden="true" />;
    case 'models':
      return <Layers className={`${iconClass} text-purple-400`} aria-hidden="true" />;
    case 'maps':
      return <Map className={`${iconClass} text-emerald-400`} aria-hidden="true" />;
    case 'skripts':
      return <Flame className={`${iconClass} text-orange-400`} aria-hidden="true" />;
    case 'clients':
      return <Monitor className={`${iconClass} text-cyan-400`} aria-hidden="true" />;
    case 'bots':
      return <Bot className={`${iconClass} text-indigo-400`} aria-hidden="true" />;
    case 'source':
      return <Code2 className={`${iconClass} text-blue-400`} aria-hidden="true" />;
  }
};

interface ResourceArtworkProps {
  theme: ArtworkTheme;
  title: string;
}

export const ResourceArtwork: React.FC<ResourceArtworkProps> = ({ theme, title }) => {
  switch (theme) {
    case 'lifesteal':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <defs>
            <linearGradient id="lsGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#042f2e" />
              <stop offset="60%" stopColor="#064e3b" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>
          </defs>
          <rect width="400" height="225" fill="url(#lsGrad)" />
          <rect x="0" y="175" width="400" height="50" fill="#022c22" opacity="0.8" />
          {/* Pixel Heart */}
          <g transform="translate(154, 34)">
            <rect x="12" y="0" width="24" height="12" fill="#ef4444" />
            <rect x="56" y="0" width="24" height="12" fill="#ef4444" />
            <rect x="0" y="12" width="92" height="24" fill="#dc2626" />
            <rect x="12" y="36" width="68" height="16" fill="#b91c1c" />
            <rect x="24" y="52" width="44" height="14" fill="#991b1b" />
            <rect x="36" y="66" width="20" height="12" fill="#7f1d1d" />
            <rect x="16" y="14" width="12" height="10" fill="#fca5a5" opacity="0.7" />
          </g>
          <text x="200" y="156" textAnchor="middle" fill="#ecfdf5" fontSize="28" fontWeight="800" fontFamily="Outfit, sans-serif" letterSpacing="1">
            LIFESTEAL SMP
          </text>
          <text x="200" y="182" textAnchor="middle" fill="#6ee7b7" fontSize="13" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            CUSTOM HEARTS · REVIVE CORE
          </text>
        </svg>
      );

    case 'earth':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <defs>
            <linearGradient id="earthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0c4a6e" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>
          </defs>
          <rect width="400" height="225" fill="url(#earthGrad)" />
          <circle cx="200" cy="96" r="56" fill="#0284c7" stroke="#38bdf8" strokeWidth="3" />
          <path d="M168 72 L194 64 L208 82 L188 102 L166 92 Z" fill="#22c55e" />
          <path d="M210 100 L236 94 L242 122 L216 130 L204 114 Z" fill="#16a34a" />
          <rect x="180" y="18" width="40" height="18" rx="3" fill="#f59e0b" />
          <text x="200" y="31" textAnchor="middle" fill="#09090b" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            SEASON 3
          </text>
          <text x="200" y="180" textAnchor="middle" fill="#f8fafc" fontSize="24" fontWeight="800" fontFamily="Outfit, sans-serif">
            EARTH SURVIVAL
          </text>
          <text x="200" y="202" textAnchor="middle" fill="#7dd3fc" fontSize="12" fontWeight="600" fontFamily="JetBrains Mono, monospace">
            1:1000 TOWNY &amp; SIEGEWAR
          </text>
        </svg>
      );

    case 'duels':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <defs>
            <linearGradient id="duelGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b0764" />
              <stop offset="60%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>
          </defs>
          <rect width="400" height="225" fill="url(#duelGrad)" />
          <g stroke="#c084fc" strokeWidth="4" strokeLinecap="square" opacity="0.35">
            <line x1="140" y1="40" x2="260" y2="160" />
            <line x1="260" y1="40" x2="140" y2="160" />
          </g>
          <rect x="65" y="76" width="270" height="58" rx="6" fill="#581c87" stroke="#c084fc" strokeWidth="2" />
          <text x="200" y="106" textAnchor="middle" fill="#faf5ff" fontSize="25" fontWeight="800" fontFamily="Outfit, sans-serif">
            STABLE DUELS
          </text>
          <text x="200" y="125" textAnchor="middle" fill="#e9d5ff" fontSize="12" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            PRACTICE ARENA · ELO CORE
          </text>
        </svg>
      );

    case 'shop':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#1c1917" />
          <rect x="0" y="0" width="400" height="44" fill="#991b1b" />
          <g fill="#fef2f2">
            <rect x="0" y="0" width="50" height="44" opacity="0.9" />
            <rect x="100" y="0" width="50" height="44" opacity="0.9" />
            <rect x="200" y="0" width="50" height="44" opacity="0.9" />
            <rect x="300" y="0" width="50" height="44" opacity="0.9" />
          </g>
          <rect x="150" y="64" width="100" height="52" rx="4" fill="#f59e0b" />
          <rect x="160" y="74" width="80" height="32" fill="#78350f" />
          <text x="200" y="96" textAnchor="middle" fill="#fef3c7" fontSize="18" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            $ SHOP
          </text>
          <text x="200" y="158" textAnchor="middle" fill="#fef3c7" fontSize="24" fontWeight="800" fontFamily="Outfit, sans-serif">
            TREND SMP SHOP
          </text>
          <text x="200" y="182" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="600" fontFamily="JetBrains Mono, monospace">
            BALANCED ECONOMY &amp; AUCTIONS
          </text>
        </svg>
      );

    case 'ender':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <defs>
            <radialGradient id="enderGlow" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#4c1d95" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#09090b" />
            </radialGradient>
          </defs>
          <rect width="400" height="225" fill="#09090b" />
          <rect width="400" height="225" fill="url(#enderGlow)" />
          {/* Ender wings & crystal silhouette */}
          <polygon points="200,32 232,96 200,164 168,96" fill="#d946ef" />
          <polygon points="200,32 232,96 200,96" fill="#f5d0fe" />
          <polygon points="168,90 95,48 122,118" fill="#7e22ce" />
          <polygon points="232,90 305,48 278,118" fill="#7e22ce" />
          <polygon points="154,122 86,104 128,150" fill="#581c87" />
          <polygon points="246,122 314,104 272,150" fill="#581c87" />
          <text x="200" y="202" textAnchor="middle" fill="#f5d0fe" fontSize="15" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            TWILIGHT OF ENDER · BOSS SUITE
          </text>
        </svg>
      );

    case 'galactic':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#1e1b4b" />
          <circle cx="52" cy="40" r="2" fill="#e0e7ff" />
          <circle cx="340" cy="36" r="2.5" fill="#c7d2fe" />
          <circle cx="310" cy="82" r="1.5" fill="#e0e7ff" />
          <text x="200" y="84" textAnchor="middle" fill="#c4b5fd" fontSize="34" fontWeight="800" fontFamily="Outfit, sans-serif">
            GALACTIC
          </text>
          <text x="200" y="122" textAnchor="middle" fill="#f5f3ff" fontSize="30" fontWeight="800" fontFamily="Outfit, sans-serif">
            HOTBAR
          </text>
          {/* BetterHud bar preview */}
          <rect x="52" y="156" width="296" height="32" rx="6" fill="#0f172a" stroke="#6366f1" strokeWidth="2" />
          <rect x="64" y="166" width="90" height="10" rx="2" fill="#ef4444" />
          <rect x="164" y="166" width="90" height="10" rx="2" fill="#38bdf8" />
          <rect x="264" y="166" width="72" height="10" rx="2" fill="#a855f7" />
        </svg>
      );

    case 'beach':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <defs>
            <linearGradient id="skyBeach" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="65%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>
          <rect width="400" height="225" fill="url(#skyBeach)" />
          <circle cx="320" cy="48" r="22" fill="#fde047" />
          <rect x="0" y="160" width="400" height="65" fill="#0f766e" />
          <rect x="110" y="148" width="180" height="32" rx="4" fill="#fcd34d" />
          {/* Palm trees & armor stand */}
          <rect x="86" y="76" width="10" height="84" fill="#78350f" />
          <polygon points="91,76 50,92 68,66" fill="#16a34a" />
          <polygon points="91,76 132,90 112,64" fill="#22c55e" />
          <rect x="186" y="74" width="28" height="44" rx="3" fill="#f59e0b" stroke="#fef08a" strokeWidth="2" />
          <rect x="190" y="50" width="20" height="20" rx="2" fill="#fbbf24" />
          <text x="200" y="206" textAnchor="middle" fill="#ecfeff" fontSize="14" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            BEACH SUMMER MODEL PACK
          </text>
        </svg>
      );

    case 'reaper':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#18181b" />
          <rect x="40" y="30" width="320" height="165" fill="#27272a" opacity="0.45" />
          <text x="200" y="42" textAnchor="middle" fill="#4ade80" fontSize="22" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            SOUL REAPER WEAPONS
          </text>
          {/* Emerald Scythe & Guardian */}
          <rect x="194" y="64" width="12" height="106" fill="#065f46" />
          <path d="M194 64 L134 84 L164 102 L206 82 Z" fill="#10b981" />
          <rect x="172" y="96" width="56" height="44" rx="4" fill="#064e3b" stroke="#34d399" strokeWidth="2" />
          <circle cx="188" cy="114" r="5" fill="#34d399" />
          <circle cx="212" cy="114" r="5" fill="#34d399" />
          <rect x="92" y="138" width="46" height="36" fill="#065f46" stroke="#10b981" strokeWidth="1.5" />
          <rect x="262" y="138" width="46" height="36" fill="#065f46" stroke="#10b981" strokeWidth="1.5" />
        </svg>
      );

    case 'tab':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#0f172a" />
          {/* Left Scoreboard panel */}
          <rect x="24" y="28" width="150" height="168" rx="4" fill="#09090b" fillOpacity="0.88" stroke="#334155" />
          <text x="99" y="50" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            SWXSTUDIOS.NET
          </text>
          <text x="36" y="74" fill="#e2e8f0" fontSize="10" fontFamily="JetBrains Mono, monospace">
            BALANCE: $73k
          </text>
          <text x="36" y="92" fill="#e2e8f0" fontSize="10" fontFamily="JetBrains Mono, monospace">
            KILLS: 14
          </text>
          <text x="36" y="110" fill="#e2e8f0" fontSize="10" fontFamily="JetBrains Mono, monospace">
            TPS: 20.0
          </text>
          <text x="36" y="138" fill="#94a3b8" fontSize="10" fontFamily="JetBrains Mono, monospace">
            ONLINE: 148/250
          </text>
          <text x="36" y="176" fill="#60a5fa" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            PLAY.YOURSERVER.NET
          </text>
          {/* Right Tablist panel */}
          <rect x="192" y="28" width="184" height="168" rx="4" fill="#09090b" fillOpacity="0.88" stroke="#334155" />
          <text x="284" y="48" textAnchor="middle" fill="#facc15" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            PING: 18ms · TPS: 20.0
          </text>
          <rect x="206" y="62" width="156" height="16" fill="#1e293b" />
          <text x="212" y="74" fill="#f87171" fontSize="9" fontFamily="JetBrains Mono, monospace">[OWNER] SwxCore</text>
          <rect x="206" y="84" width="156" height="16" fill="#1e293b" />
          <text x="212" y="96" fill="#c084fc" fontSize="9" fontFamily="JetBrains Mono, monospace">[ADMIN] KaelenDev</text>
          <rect x="206" y="106" width="156" height="16" fill="#1e293b" />
          <text x="212" y="118" fill="#4ade80" fontSize="9" fontFamily="JetBrains Mono, monospace">[VIP] PhoenixCraft</text>
          <rect x="206" y="128" width="156" height="16" fill="#1e293b" />
          <text x="212" y="140" fill="#cbd5e1" fontSize="9" fontFamily="JetBrains Mono, monospace">[MEMBER] LunisDev</text>
        </svg>
      );

    case 'werewolf':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <defs>
            <linearGradient id="moonSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>
          <rect width="400" height="225" fill="url(#moonSky)" />
          <circle cx="240" cy="64" r="24" fill="#e2e8f0" opacity="0.9" />
          <polygon points="0,175 60,110 110,160 175,96 240,175" fill="#09090b" />
          <polygon points="210,175 280,104 345,155 400,115 400,175" fill="#09090b" />
          <rect x="0" y="150" width="400" height="75" fill="#09090b" opacity="0.82" />
          <text x="200" y="196" textAnchor="middle" fill="#a855f7" fontSize="31" fontWeight="800" fontFamily="Outfit, sans-serif">
            WEREWOLF PACK
          </text>
        </svg>
      );

    case 'anticheat':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#18181b" />
          <rect x="0" y="0" width="400" height="225" fill="#dc2626" opacity="0.14" />
          <text x="200" y="76" textAnchor="middle" fill="#f87171" fontSize="28" fontWeight="800" fontFamily="Outfit, sans-serif">
            GRIM + VULCAN
          </text>
          <text x="200" y="106" textAnchor="middle" fill="#fafafa" fontSize="14" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            ANTICHEAT CONFIGURATION
          </text>
          <rect x="52" y="128" width="296" height="22" rx="3" fill="#dc2626" />
          <text x="200" y="143" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            MULTILANGUAGE · HIGH QUALITY · CHECKS
          </text>
          {/* Language tag blocks */}
          <g transform="translate(106, 166)">
            <rect x="0" y="0" width="36" height="22" rx="2" fill="#f8fafc" />
            <rect x="0" y="11" width="36" height="11" rx="1" fill="#dc2626" />
            <rect x="50" y="0" width="36" height="22" rx="2" fill="#dc2626" />
            <rect x="50" y="6" width="36" height="10" fill="#facc15" />
            <rect x="100" y="0" width="36" height="22" rx="2" fill="#dc2626" />
            <circle cx="116" cy="11" r="5" fill="#ffffff" />
            <rect x="150" y="0" width="36" height="22" rx="2" fill="#1d4ed8" />
            <rect x="165" y="0" width="6" height="22" fill="#dc2626" />
            <rect x="150" y="8" width="36" height="6" fill="#dc2626" />
          </g>
        </svg>
      );

    case 'obsidian_ac':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <defs>
            <linearGradient id="obsGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="55%" stopColor="#18181b" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>
          </defs>
          <rect width="400" height="225" fill="url(#obsGrad)" />
          <polygon points="200,34 252,58 242,126 200,154 158,126 148,58" fill="#312e81" stroke="#818cf8" strokeWidth="2.5" />
          <polygon points="200,52 232,68 224,116 200,134 176,116 168,68" fill="#1e1b4b" />
          <circle cx="200" cy="92" r="10" fill="#a5b4fc" />
          <text x="200" y="184" textAnchor="middle" fill="#f4f4f5" fontSize="20" fontWeight="800" fontFamily="Outfit, sans-serif">
            OBSIDIANGUARD AC
          </text>
          <text x="200" y="204" textAnchor="middle" fill="#a5b4fc" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            PACKET PREDICTION · ANTI-VELOCITY
          </text>
        </svg>
      );

    case 'rtp':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <defs>
            <linearGradient id="rtpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#18181b" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>
          </defs>
          <rect width="400" height="225" fill="url(#rtpGrad)" />
          <text x="200" y="54" textAnchor="middle" fill="#d4d4d8" fontSize="16" letterSpacing="6">
            ★★★★★
          </text>
          <text x="200" y="112" textAnchor="middle" fill="#f4f4f5" fontSize="30" fontWeight="800" fontFamily="Outfit, sans-serif">
            RTP MENU CONFIG
          </text>
          <text x="200" y="142" textAnchor="middle" fill="#a1a1aa" fontSize="14" fontWeight="500" fontFamily="Outfit, sans-serif">
            Your Menu, Our Design
          </text>
          <text x="200" y="198" textAnchor="middle" fill="#71717a" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            SWXSTUDIOS VERIFIED
          </text>
        </svg>
      );

    case 'crates':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#1c1917" />
          <polygon points="200,36 270,72 200,108 130,72" fill="#f59e0b" />
          <polygon points="130,72 200,108 200,168 130,132" fill="#b45309" />
          <polygon points="270,72 200,108 200,168 270,132" fill="#d97706" />
          <rect x="188" y="96" width="24" height="20" rx="2" fill="#fef3c7" />
          <text x="200" y="200" textAnchor="middle" fill="#fde68a" fontSize="16" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            SWXCRATES · 3D ANIMATIONS
          </text>
        </svg>
      );

    case 'skyblock':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#082f49" />
          <polygon points="200,72 276,104 200,136 124,104" fill="#4ade80" />
          <polygon points="124,104 200,136 200,166 124,134" fill="#78350f" />
          <polygon points="276,104 200,136 200,166 276,134" fill="#92400e" />
          <rect x="192" y="38" width="14" height="44" fill="#78350f" />
          <rect x="172" y="20" width="54" height="24" fill="#22c55e" />
          <text x="200" y="200" textAnchor="middle" fill="#bae6fd" fontSize="16" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            SKYCORE ISLANDS PRO
          </text>
        </svg>
      );

    case 'prison':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#18181b" />
          <rect x="96" y="42" width="208" height="104" rx="6" fill="#27272a" stroke="#fb923c" strokeWidth="2" />
          <text x="200" y="88" textAnchor="middle" fill="#fdba74" fontSize="24" fontWeight="800" fontFamily="Outfit, sans-serif">
            PRISON CORE
          </text>
          <text x="200" y="116" textAnchor="middle" fill="#fed7aa" fontSize="13" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            24 CUSTOM PICKAXE ENCHANTS
          </text>
          <text x="200" y="186" textAnchor="middle" fill="#a1a1aa" fontSize="12" fontFamily="JetBrains Mono, monospace">
            MULTI-CURRENCY · PRESTIGE TREES
          </text>
        </svg>
      );

    case 'skript':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#141418" />
          <rect x="70" y="34" width="260" height="142" rx="6" fill="#09090b" stroke="#fbbf24" strokeWidth="1.5" />
          <text x="90" y="64" fill="#fbbf24" fontSize="12" fontFamily="JetBrains Mono, monospace">on koth capture:</text>
          <text x="104" y="88" fill="#e4e4e7" fontSize="12" fontFamily="JetBrains Mono, monospace">add 1000 to player&apos;s balance</text>
          <text x="104" y="112" fill="#4ade80" fontSize="12" fontFamily="JetBrains Mono, monospace">broadcast &quot;KOTH Claimed!&quot;</text>
          <text x="104" y="136" fill="#94a3b8" fontSize="12" fontFamily="JetBrains Mono, monospace">trigger bounty reward</text>
          <text x="200" y="202" textAnchor="middle" fill="#fde68a" fontSize="13" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            BOXPVP KOTH &amp; BOUNTY SKRIPT
          </text>
        </svg>
      );

    case 'client':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#09090b" />
          <rect x="44" y="30" width="312" height="155" rx="8" fill="#111827" stroke="#38bdf8" strokeWidth="2" />
          <text x="200" y="96" textAnchor="middle" fill="#f0f9ff" fontSize="28" fontWeight="800" fontFamily="Outfit, sans-serif">
            SWXBOOST 1.21
          </text>
          <text x="200" y="128" textAnchor="middle" fill="#38bdf8" fontSize="14" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            2.4X FPS · DARK PVP HUD
          </text>
        </svg>
      );

    case 'bot':
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#0f172a" />
          <rect x="136" y="42" width="128" height="96" rx="14" fill="#4f46e5" />
          <circle cx="174" cy="90" r="10" fill="#fef08a" />
          <circle cx="226" cy="90" r="10" fill="#fef08a" />
          <text x="200" y="176" textAnchor="middle" fill="#e0e7ff" fontSize="18" fontWeight="800" fontFamily="Outfit, sans-serif">
            SWXLINK DISCORD BOT
          </text>
          <text x="200" y="198" textAnchor="middle" fill="#a5b4fc" fontSize="11" fontFamily="JetBrains Mono, monospace">
            TICKETS · ROLE SYNC · TEBEX LOGS
          </text>
        </svg>
      );

    case 'source':
    default:
      return (
        <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={title}>
          <rect width="400" height="225" fill="#09090b" />
          <rect x="36" y="28" width="328" height="169" rx="6" fill="#111114" stroke="#27272a" />
          <text x="56" y="64" fill="#38bdf8" fontSize="13" fontFamily="JetBrains Mono, monospace">
            public final class HeartCore extends JavaPlugin
          </text>
          <text x="56" y="92" fill="#a1a1aa" fontSize="12" fontFamily="JetBrains Mono, monospace">
            // Paper 1.21.4 · Java 21 · HikariCP
          </text>
          <text x="56" y="122" fill="#4ade80" fontSize="12" fontFamily="JetBrains Mono, monospace">
            HeartTransaction.transfer(victim, killer, 1);
          </text>
          <text x="56" y="154" fill="#f4f4f5" fontSize="16" fontWeight="700" fontFamily="Outfit, sans-serif">
            Clean Maven Source Repository
          </text>
        </svg>
      );
  }
};
