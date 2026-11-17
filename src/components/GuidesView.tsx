import React, { useMemo, useState } from 'react';
import { BookOpen, Check, Copy, Search } from 'lucide-react';

interface GuideArticle {
  id: string;
  title: string;
  readTime: string;
  category: string;
  summary: string;
  sections: { heading: string; body: string; code?: string }[];
}

const STUDIO_GUIDES: GuideArticle[] = [
  {
    id: 'paper-purpur-folia',
    title: 'Paper, Purpur, or Folia? Picking the right server jar',
    readTime: '3 min read',
    category: 'Server Setup',
    summary:
      'Compare thread models, plugin compatibility, and performance tuning across Paper, Purpur, and Folia.',
    sections: [
      {
        heading: 'When to pick Paper',
        body: 'Paper is the baseline standard for Survival, Skyblock, Prisons, and Minigame servers. Almost every Bukkit/Spigot plugin targets Paper API directly without compatibility patches.',
      },
      {
        heading: 'When to pick Purpur',
        body: 'Purpur adds extra configuration toggles (villager lobotomization, entity DAB, custom gameplay mechanics) on top of Paper with zero plugin breakage.',
      },
      {
        heading: 'When to pick Folia',
        body: 'Folia splits the world into independent ticked regions across multiple CPU threads. Ideal for massive 250+ player anarchies or SMPs, but requires plugins explicitly marked Folia-compatible.',
      },
    ],
  },
  {
    id: 'memory-flags',
    title: 'Memory & Aikar / G1GC startup flags',
    readTime: '3 min read',
    category: 'Performance',
    summary:
      'Recommended JVM garbage-collection flags to avoid stop-the-world lag spikes on 4GB–16GB servers.',
    sections: [
      {
        heading: 'Avoid over-allocating heap',
        body: 'Allocating 32GB when your server only needs 8GB increases GC pause lengths and starves Linux disk cache. Match -Xms and -Xmx cleanly leaving at least 2GB for the OS.',
      },
      {
        heading: 'Production G1GC Startup Line',
        body: 'Copy this startup flag template for Minecraft 1.20.5+ (Java 21):',
        code: 'java -Xms8G -Xmx8G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -jar server.jar --nogui',
      },
    ],
  },
  {
    id: 'color-gradients',
    title: 'Color codes, HEX colors, and MiniMessage gradients',
    readTime: '4 min read',
    category: 'Formatting',
    summary:
      'Use legacy & codes alongside 1.16+ HEX gradients cleanly across chat, scoreboards, TAB, and MOTDs.',
    sections: [
      {
        heading: 'Legacy vs Modern Syntax',
        body: 'Use &a / &c for basic colors, &#e11d48 or &x&e&1&1&d&4&8 for Paper/Spigot plugins, and <gradient:#e11d48:#f59e0b>Text</gradient> for Adventure/MiniMessage plugins.',
        code: 'motd=\\u00A7c\\u00A7lSWXSTUDIOS \\u00A78| \\u00A77Paper 1.21.4\\n\\u00A7aSurvival, BoxPVP & Custom Events',
      },
    ],
  },
  {
    id: 'economy-shop',
    title: 'Balancing prices in a server shop & auction house',
    readTime: '4 min read',
    category: 'Economy',
    summary:
      'Stop hyperinflation early by setting sell-to-buy spreads, farm caps, and money sinks.',
    sections: [
      {
        heading: 'Prevent Arbitrage Loops',
        body: 'Never price an item craftable from cheaper shop ingredients higher than the raw ingredient total. Keep sell price below 60% of buy price.',
      },
      {
        heading: 'Healthy Economy Sinks',
        body: 'Pair AFK farms with auction taxes (5%–10%), rank upgrades, land claim upkeep, or repair fees so currency circulates steadily.',
      },
    ],
  },
  {
    id: 'luckperms-hierarchy',
    title: 'Structuring LuckPerms ranks, weights, and server contexts',
    readTime: '4 min read',
    category: 'Permissions',
    summary:
      'Clean inheritance trees that scale across single servers and Velocity/BungeeCord networks.',
    sections: [
      {
        heading: 'Weight Matters',
        body: 'Assign explicit weights (e.g., default=10, vip=20, mod=80, admin=100) so TAB/chat prefixes resolve deterministically.',
        code: '/lp group vip parent add default\n/lp group vip permission set essentials.fly true server=survival',
      },
    ],
  },
  {
    id: 'spark-profiling',
    title: 'Diagnosing TPS & MSPT drops with Spark',
    readTime: '4 min read',
    category: 'Performance',
    summary:
      'Read TPS vs MSPT accurately so you catch entity, tile-entity, and plugin lag before TPS hits 18.',
    sections: [
      {
        heading: 'Target Under 40ms MSPT',
        body: '20 TPS only requires staying under 50ms per tick. Once MSPT crosses 45ms, any sudden chunk generation or mob farm activation drops TPS below 20.',
        code: '/spark profiler start --timeout 60\n/spark health --memory',
      },
    ],
  },
];

interface GuidesViewProps {
  onNotify?: (msg: string) => void;
}

export const GuidesView: React.FC<GuidesViewProps> = ({ onNotify }) => {
  const [selectedId, setSelectedId] = useState(STUDIO_GUIDES[0].id);
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return STUDIO_GUIDES;
    return STUDIO_GUIDES.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.summary.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
    );
  }, [search]);

  const activeGuide = STUDIO_GUIDES.find((g) => g.id === selectedId) ?? STUDIO_GUIDES[0];

  const copySnippet = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      onNotify?.('Copied snippet to clipboard');
      window.setTimeout(() => setCopiedCode((p) => (p === text ? null : p)), 1800);
    } catch {
      onNotify?.('Clipboard unavailable.');
    }
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-rose-400">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>SwxStudios / Server Engineering Guides</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            Minecraft Server Guides
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Practical playbooks for Paper, Purpur, Folia, JVM flags, HEX formatting, shop economy, and Spark profiling.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guides..."
            aria-label="Search guides"
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-4 space-y-2">
          {filtered.map((guide) => {
            const active = guide.id === activeGuide.id;
            return (
              <button
                key={guide.id}
                type="button"
                onClick={() => setSelectedId(guide.id)}
                className={`w-full rounded-lg border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-rose-500/80 bg-zinc-900 text-white'
                    : 'border-zinc-800/80 bg-[#111114] text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-display-mono text-zinc-500">
                  <span className={active ? 'text-rose-400' : ''}>{guide.category}</span>
                  <span>{guide.readTime}</span>
                </div>
                <p className="mt-1 text-xs font-bold leading-snug">{guide.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">{guide.summary}</p>
              </button>
            );
          })}
        </aside>

        <article className="lg:col-span-8 rounded-xl border border-zinc-800/90 bg-[#111114] p-6 space-y-6">
          <header className="border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2 text-[11px] font-display-mono text-rose-400">
              <span>{activeGuide.category}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">{activeGuide.readTime}</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-white">{activeGuide.title}</h2>
            <p className="mt-1.5 text-sm text-zinc-400">{activeGuide.summary}</p>
          </header>

          <div className="space-y-6">
            {activeGuide.sections.map((sec) => (
              <section key={sec.heading} className="space-y-2.5">
                <h3 className="text-sm font-bold text-white">{sec.heading}</h3>
                <p className="text-xs leading-relaxed text-zinc-300">{sec.body}</p>
                {sec.code && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/60">
                      <span className="font-display-mono text-[10px] text-zinc-500">Command / Snippet</span>
                      <button
                        type="button"
                        onClick={() => void copySnippet(sec.code!)}
                        className="inline-flex h-7 items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/60"
                      >
                        {copiedCode === sec.code ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedCode === sec.code ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="mt-2 overflow-x-auto font-display-mono text-xs text-rose-200 whitespace-pre-wrap break-all">
                      {sec.code}
                    </pre>
                  </div>
                )}
              </section>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
};
