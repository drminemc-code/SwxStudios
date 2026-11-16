import React from 'react';
import { Award, CheckCircle2, Trophy } from 'lucide-react';
import { LEVEL_TIERS } from '../data/catalog';
import { getLevelInfo } from '../utils/catalogLogic';

interface LevelsViewProps {
  xp: number;
  downloadedCount: number;
  threadsCreatedCount: number;
  isPremium: boolean;
}

interface LeaderboardEntry {
  name: string;
  role: string;
  xp: number;
}

const LEADERBOARD: LeaderboardEntry[] = [];

export const LevelsView: React.FC<LevelsViewProps> = ({
  xp,
  downloadedCount,
  threadsCreatedCount,
  isPremium,
}) => {
  const levelInfo = getLevelInfo(xp, LEVEL_TIERS);

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-zinc-800 bg-[#111114] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
              <Award className="h-4 w-4 text-zinc-200" aria-hidden="true" />
              <span>Studio Progression</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Level {levelInfo.current.level} · {levelInfo.current.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Earn XP by downloading packages (+25 XP), rating resources (+15 XP), and posting threads (+30 XP).
              {isPremium && ' 2x Premium XP multiplier is active.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-3.5 text-center tabular-nums">
            <div>
              <p className="text-lg font-extrabold text-white">{xp}</p>
              <p className="text-[11px] text-zinc-500">Total XP</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-white">{downloadedCount}</p>
              <p className="text-[11px] text-zinc-500">Downloads</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-white">{threadsCreatedCount}</p>
              <p className="text-[11px] text-zinc-500">Threads</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-zinc-400 tabular-nums">
            <span>{levelInfo.current.name}</span>
            <span>
              {levelInfo.next
                ? `${levelInfo.xpToNext} XP until ${levelInfo.next.name}`
                : 'Maximum Tier Reached'}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tiers & Leaderboard Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-[#111114] p-5 sm:p-6">
          <h2 className="text-base font-bold text-white">Rank Tiers</h2>
          <div className="mt-4 divide-y divide-zinc-800/70">
            {LEVEL_TIERS.map((tier) => {
              const unlocked = xp >= tier.minXp;
              return (
                <div
                  key={tier.level}
                  className={`flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 ${
                    unlocked ? 'opacity-100' : 'opacity-65'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        unlocked ? 'text-emerald-400' : 'text-zinc-600'
                      }`}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        Level {tier.level} · {tier.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">{tier.perks}</p>
                    </div>
                  </div>
                  <span className="font-display-mono shrink-0 text-xs font-semibold text-zinc-400 tabular-nums">
                    {tier.minXp} XP
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-[#111114] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <h2 className="text-base font-bold text-white">Top Contributors</h2>
          </div>

          {LEADERBOARD.length === 0 ? (
            <div className="mt-4 border-t border-zinc-800/80 pt-5 text-xs text-zinc-400">
              <p className="font-medium text-zinc-200">No ranked members yet</p>
              <p className="mt-1 text-zinc-500">
                Rankings update as members download packages, rate releases, and start threads.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="pb-2.5 font-medium">Rank</th>
                    <th className="pb-2.5 font-medium">Member</th>
                    <th className="pb-2.5 font-medium">Tier</th>
                    <th className="pb-2.5 text-right font-medium">XP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 tabular-nums">
                  {LEADERBOARD.map((member, idx) => (
                    <tr key={member.name}>
                      <td className="py-3 font-display-mono font-bold text-zinc-400">
                        #{idx + 1}
                      </td>
                      <td className="py-3 font-semibold text-zinc-100">{member.name}</td>
                      <td className="py-3 text-zinc-400">{member.role}</td>
                      <td className="py-3 text-right font-bold text-zinc-100">{member.xp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
