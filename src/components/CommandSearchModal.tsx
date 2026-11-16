import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { ResourceItem } from '../types';
import { filterResources } from '../utils/catalogLogic';

interface CommandSearchModalProps {
  open: boolean;
  resources: ResourceItem[];
  onClose: () => void;
  onSelectResource: (resource: ResourceItem) => void;
}

export const CommandSearchModal: React.FC<CommandSearchModalProps> = ({
  open,
  resources,
  onClose,
  onSelectResource,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const matches = filterResources(resources, { query }).slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Quick search resources"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-800 bg-[#111114] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          <label htmlFor="cmd-search-input" className="sr-only">
            Search SwxStudios catalog
          </label>
          <input
            id="cmd-search-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a plugin, setup, model, or tag (e.g. lifesteal, vulcan)..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {matches.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              No resources matched &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul className="space-y-1">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectResource(item);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-900"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-zinc-400">
                        {item.category} · {item.mcVersions} · {item.downloads} downloads
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
