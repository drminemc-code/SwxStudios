import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Download,
  MapPin,
  Moon,
  RefreshCw,
  Sun,
  Sunset,
  X,
} from 'lucide-react';
import { MinecraftServerListing } from '../types';
import {
  createSeedFromString,
  type MapLightingMode,
  renderWorldPreviewCanvas,
  resolveWorldPreviewSpec,
} from '../utils/worldMapGenerator';

interface ExploreMapModalProps {
  server: MinecraftServerListing | null;
  onClose: () => void;
}

const LIGHTING_OPTIONS: Array<{
  id: MapLightingMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'golden', label: 'Golden Hour', Icon: Sunset },
  { id: 'day', label: 'Daylight', Icon: Sun },
  { id: 'night', label: 'Midnight', Icon: Moon },
];

export const ExploreMapModal: React.FC<ExploreMapModalProps> = ({ server, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [lighting, setLighting] = useState<MapLightingMode>('golden');
  const [seedOffset, setSeedOffset] = useState(0);

  const spec = useMemo(() => {
    if (!server) return null;
    return resolveWorldPreviewSpec(server.name, server.address, server.gameModes || []);
  }, [server]);

  const activeSeed = useMemo(() => {
    if (!server) return 1;
    return createSeedFromString(`${server.id}:${server.address}:${seedOffset}`);
  }, [server, seedOffset]);

  useEffect(() => {
    if (!server) return;
    setSeedOffset(0);
    setLighting('golden');
  }, [server?.id]);

  useEffect(() => {
    if (!server) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [server, onClose]);

  useEffect(() => {
    if (!spec || !canvasRef.current) return;
    renderWorldPreviewCanvas(canvasRef.current, spec, activeSeed, lighting);
  }, [spec, activeSeed, lighting]);

  if (!server || !spec) return null;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    const slug = server.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'world';
    a.href = url;
    a.download = `${slug}-explore-map.png`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Explore Map for ${server.name}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0d0d11] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800/90 bg-[#111114] px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-rose-400">
              <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>World Map Preview</span>
              <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-display-mono text-[10px] text-zinc-300">
                {server.address}
              </span>
            </div>
            <h2 className="mt-1 text-base sm:text-lg font-extrabold tracking-tight text-white leading-snug">
              {server.name} — {spec.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Explore Map preview"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Controls Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="World lighting mode">
              {LIGHTING_OPTIONS.map(({ id, label, Icon }) => {
                const active = lighting === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLighting(id)}
                    aria-pressed={active}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-rose-500 bg-rose-600 text-white'
                        : 'border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSeedOffset((prev) => prev + 1)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-[#111114] px-3 text-xs font-semibold text-zinc-200 hover:border-zinc-700 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span>New Seed</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-500"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Download PNG</span>
              </button>
            </div>
          </div>

          {/* 16:9 Isometric Voxel Preview */}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#07070a]">
            <canvas
              ref={canvasRef}
              data-testid="explore-map-canvas"
              width={960}
              height={540}
              className="block w-full aspect-video"
              aria-label={`Isometric world preview of ${server.name}`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 bg-[#0b0b0f] px-3.5 py-2">
              <span className="text-[11px] font-medium text-zinc-300">
                {spec.subtitle}
              </span>
              <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-display-mono text-[10px] text-zinc-400">
                SEED #{activeSeed}
              </span>
            </div>
          </div>

          {/* Tag Breakdown & World Landmarks */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Listed World Tags
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {spec.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Generated Map Landmarks
              </h3>
              <ul className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {spec.landmarks.map((landmark) => (
                  <li
                    key={landmark}
                    className="flex items-center gap-1.5 text-xs text-zinc-200"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                    <span className="truncate">{landmark}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
