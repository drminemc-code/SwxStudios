import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Search, Wrench, X } from 'lucide-react';
import { ResourceItem } from '../types';
import { filterResources } from '../utils/catalogLogic';
import { TOOL_DIRECTORY, type ToolId } from './ToolsView';

interface CommandSearchModalProps {
  open: boolean;
  resources: ResourceItem[];
  onClose: () => void;
  onSelectResource: (resource: ResourceItem) => void;
  onSelectTool?: (toolId: ToolId) => void;
}

export const CommandSearchModal: React.FC<CommandSearchModalProps> = ({
  open,
  resources,
  onClose,
  onSelectResource,
  onSelectTool,
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

  const qLower = query.trim().toLowerCase();
  const toolMatches = TOOL_DIRECTORY.filter((t) => {
    if (!qLower) return ['motd', 'fonts', 'status', 'spark', 'luckperms'].includes(t.id);
    return (
      t.title.toLowerCase().includes(qLower) ||
      t.description.toLowerCase().includes(qLower) ||
      t.categoryLabel.toLowerCase().includes(qLower)
    );
  }).slice(0, 5);

  const matches = filterResources(resources, { query }).slice(0, 6);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Quick search resources and tools"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-800 bg-[#111114] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          <label htmlFor="cmd-search-input" className="sr-only">
            Search SwxStudios catalog and tools
          </label>
          <input
            id="cmd-search-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins, setups, or tools (e.g. font, spark, motd, lifesteal)..."
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

        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {toolMatches.length > 0 && onSelectTool && (
            <div>
              <p className="px-3 py-1 font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Studio Tools
              </p>
              <ul className="space-y-1">
                {toolMatches.map((tool) => (
                  <li key={tool.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTool(tool.id);
                        onClose();
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-900"
                    >
                      <div className="flex min-w-0 items-center gap-2.5 pr-3">
                        <Wrench className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-100">
                            {tool.title}
                          </p>
                          <p className="truncate text-xs text-zinc-400">
                            {tool.categoryLabel} · {tool.description}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="px-3 py-1 font-display-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Resources
            </p>
            {matches.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-zinc-500">
                {query.trim()
                  ? `No resources matched "${query}".`
                  : 'No resources uploaded yet.'}
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
    </div>
  );
};
