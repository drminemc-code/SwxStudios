import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  FileArchive,
  Flame,
  Layers,
  Lock,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Sliders,
  Star,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { CATEGORIES } from '../data/catalog';
import {
  ArtworkTheme,
  CategoryId,
  CommunityThread,
  MembershipOrder,
  MinecraftServerListing,
  ResourceItem,
  ResourceTier,
  SiteSettings,
} from '../types';
import {
  ARCHIVE_ACCEPT_ATTR,
  ARTWORK_OPTIONS,
  defaultResourceTypeForCategory,
  extractArchiveExtension,
  formatFileSize,
  MAX_UPLOAD_BYTES,
  OWNER_EMAILS,
  RESOURCE_TYPE_OPTIONS,
  ResourceDraftInput,
  SOFTWARE_OPTIONS,
  TIER_OPTIONS,
  validateResourceDraft,
} from '../utils/adminLogic';
import { getEffectiveResourceTier } from '../utils/catalogLogic';
import { ResourceArtwork } from './ResourceArtwork';

type AdminWorkspaceTab = 'upload' | 'catalog' | 'controls';

interface AdminPanelViewProps {
  isOwner: boolean;
  isSignedIn: boolean;
  ownerDisplayName: string;
  ownerEmail?: string | null;
  resources: ResourceItem[];
  threads: CommunityThread[];
  servers: MinecraftServerListing[];
  membershipOrders?: MembershipOrder[];
  siteSettings: SiteSettings;
  onRequireSignIn: () => void;
  onReturnHome: () => void;
  onUploadFile: (file: File) => Promise<{
    fileName: string;
    fileExtension: string;
    byteSize: number;
    downloadUrl: string;
  }>;
  onPublishResource: (draft: ResourceDraftInput, editingId?: string) => Promise<void>;
  onDeleteResource: (resource: ResourceItem) => Promise<void>;
  onDownloadResource: (resource: ResourceItem) => void;
  onSaveSiteSettings: (settings: SiteSettings) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
  onUpdateServerFlags: (
    serverId: string,
    updates: { approved?: boolean; featured?: boolean }
  ) => Promise<void>;
  onDeleteServer: (serverId: string) => Promise<void>;
  onResolveMembershipOrder?: (
    order: MembershipOrder,
    decision: 'approved' | 'declined'
  ) => Promise<void>;
  onOpenTiersConsole?: () => void;
}

function createEmptyDraft(authorName: string): ResourceDraftInput {
  return {
    title: '',
    subtitle: '',
    description: '',
    category: 'plugins',
    version: 'v1.0.0',
    mcVersions: '1.20.4 - 1.21.4',
    fileSize: '',
    author: authorName || 'SwxStudios',
    popular: false,
    exclusive: false,
    tier: 'free',
    priceLabel: '',
    openSource: false,
    drmFree: true,
    unobfuscated: true,
    aiMarketing: false,
    aiProduct: false,
    resourceType: 'Plugin',
    gameModesText: 'Survival, BoxPVP',
    supportedSoftware: ['Bukkit', 'Spigot', 'Paper', 'Purpur'],
    supportedVersionsText: '1.21, 1.20',
    supportedLanguagesText: 'English',
    dependenciesText: '',
    changelogText: '',
    demoVideoUrl: '',
    tagsText: '',
    featuresText: '',
    artwork: 'lifesteal',
    fileName: '',
    downloadUrl: '',
  };
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  isOwner,
  isSignedIn,
  ownerDisplayName,
  ownerEmail,
  resources,
  threads,
  servers,
  membershipOrders = [],
  siteSettings,
  onRequireSignIn,
  onReturnHome,
  onUploadFile,
  onPublishResource,
  onDeleteResource,
  onDownloadResource,
  onSaveSiteSettings,
  onDeleteThread,
  onUpdateServerFlags,
  onDeleteServer,
  onResolveMembershipOrder,
  onOpenTiersConsole,
}) => {
  const [workspaceTab, setWorkspaceTab] = useState<AdminWorkspaceTab>('upload');
  const [draft, setDraft] = useState<ResourceDraftInput>(() =>
    createEmptyDraft(ownerDisplayName)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [manageQuery, setManageQuery] = useState('');
  const [manageCategory, setManageCategory] = useState<CategoryId | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Owner Controls state
  const [settingsDraft, setSettingsDraft] = useState<SiteSettings>(siteSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [confirmDeleteThreadId, setConfirmDeleteThreadId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [resolvingOrderId, setResolvingOrderId] = useState<string | null>(null);

  useEffect(() => {
    setSettingsDraft(siteSettings);
  }, [siteSettings]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(() => {
    const totalViews = resources.reduce(
      (sum, r) => sum + (r.views ?? Math.max((r.downloads || 0) * 4, r.downloads || 0)),
      0
    );
    const totalDownloads = resources.reduce((sum, r) => sum + (r.downloads || 0), 0);
    return {
      total: resources.length,
      totalViews,
      totalDownloads,
      threadsCount: threads.length,
    };
  }, [resources, threads]);

  const filteredResources = useMemo(() => {
    const q = manageQuery.trim().toLowerCase();
    return resources.filter((item) => {
      if (manageCategory !== 'all' && item.category !== manageCategory) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.fileName.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [resources, manageQuery, manageCategory]);

  if (!isOwner) {
    return (
      <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-lg rounded-xl border border-zinc-800 bg-[#111114] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">Owner Controls Restricted</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Only verified SwxStudios owners can upload packages, manage catalog specs, or adjust site controls.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {!isSignedIn && (
              <button
                type="button"
                onClick={onRequireSignIn}
                className="inline-flex h-10 items-center justify-center rounded-md bg-white px-5 text-xs font-bold text-zinc-950 hover:bg-zinc-200"
              >
                Sign In as Owner
              </button>
            )}
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              Return Home
            </button>
          </div>
        </div>
      </section>
    );
  }

  const handleSelectedFile = async (file: File) => {
    setFormError(null);
    setFormSuccess(null);

    const ext = extractArchiveExtension(file.name);
    if (!ext) {
      setFormError(
        'Unsupported file type. Allowed formats: .jar, .zip, .rar, .7z, .gz, .tar'
      );
      return;
    }
    if (file.size <= 0) {
      setFormError('Selected file is empty.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFormError('File exceeds the 100 MB archive upload limit.');
      return;
    }

    setUploading(true);
    try {
      const uploaded = await onUploadFile(file);
      const inferredTitle = file.name
        .replace(/\.(tar\.gz|jar|zip|rar|7z|gz|tar)$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .slice(0, 100);

      setDraft((prev) => ({
        ...prev,
        fileName: uploaded.fileName,
        fileSize: formatFileSize(uploaded.byteSize),
        downloadUrl: uploaded.downloadUrl,
        title: prev.title || inferredTitle,
      }));
      setFormSuccess(`Uploaded ${uploaded.fileName} (${formatFileSize(uploaded.byteSize)})`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const errMsg = validateResourceDraft(draft);
    if (errMsg) {
      setFormError(errMsg);
      return;
    }

    setSubmitting(true);
    try {
      await onPublishResource(draft, editingId ?? undefined);
      setFormSuccess(
        editingId
          ? `Updated "${draft.title.trim()}".`
          : `Published "${draft.title.trim()}" to the SwxStudios catalog.`
      );
      setEditingId(null);
      setDraft(createEmptyDraft(ownerDisplayName));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not publish resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (item: ResourceItem) => {
    setEditingId(item.id);
    setFormError(null);
    setFormSuccess(null);
    setDraft({
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      category: item.category,
      version: item.version,
      mcVersions: item.mcVersions,
      fileSize: item.fileSize,
      author: item.author,
      popular: Boolean(item.popular),
      exclusive: Boolean(item.exclusive),
      tier: getEffectiveResourceTier(item),
      priceLabel: item.priceLabel || '',
      openSource: Boolean(item.openSource),
      drmFree: item.drmFree !== false,
      unobfuscated: item.unobfuscated !== false,
      aiMarketing: Boolean(item.aiMarketing),
      aiProduct: Boolean(item.aiProduct),
      resourceType: item.resourceType || defaultResourceTypeForCategory(item.category),
      gameModesText: (item.gameModes && item.gameModes.length > 0 ? item.gameModes : ['Survival']).join(', '),
      supportedSoftware:
        item.supportedSoftware && item.supportedSoftware.length > 0
          ? item.supportedSoftware
          : ['Bukkit', 'Spigot', 'Paper', 'Purpur'],
      supportedVersionsText:
        item.supportedVersions && item.supportedVersions.length > 0
          ? item.supportedVersions.join(', ')
          : item.mcVersions,
      supportedLanguagesText:
        item.supportedLanguages && item.supportedLanguages.length > 0
          ? item.supportedLanguages.join(', ')
          : 'English',
      dependenciesText: (item.dependencies || []).join(', '),
      changelogText: (item.changelog || [])
        .map((c) => `${c.version} | ${c.date} | ${c.notes}`)
        .join('\n'),
      demoVideoUrl: item.demoVideoUrl || '',
      tagsText: item.tags.join(', '),
      featuresText: item.features.join('\n'),
      artwork: item.artwork,
      fileName: item.fileName,
      downloadUrl: item.downloadUrl || `/api/files/${encodeURIComponent(item.fileName)}`,
    });
    setWorkspaceTab('upload');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmDelete = async (item: ResourceItem) => {
    setDeletingId(item.id);
    try {
      await onDeleteResource(item);
      if (editingId === item.id) {
        setEditingId(null);
        setDraft(createEmptyDraft(ownerDisplayName));
      }
      setConfirmDeleteId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not delete resource.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsFeedback(null);
    setSavingSettings(true);
    try {
      await onSaveSiteSettings({
        announcementVisible: Boolean(settingsDraft.announcementVisible),
        announcementLabel: settingsDraft.announcementLabel.trim() || 'SwxStudios',
        announcementText:
          settingsDraft.announcementText.trim() ||
          'Free, Paid, Popular, Premium, and Ultimate releases verified for Minecraft servers.',
        communityEnabled: settingsDraft.communityEnabled !== false,
        heroHeadline: settingsDraft.heroHeadline?.trim() || '',
        gcashNumber: settingsDraft.gcashNumber?.trim() || '',
        gcashName: settingsDraft.gcashName?.trim() || '',
        paypalEmail: settingsDraft.paypalEmail?.trim() || '',
        paypalLink: settingsDraft.paypalLink?.trim() || '',
      });
      setSettingsFeedback('Site settings synced to Firestore.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save site settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleThreadDelete = async (threadId: string) => {
    setDeletingThreadId(threadId);
    try {
      await onDeleteThread(threadId);
      setConfirmDeleteThreadId(null);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to delete thread.');
    } finally {
      setDeletingThreadId(null);
    }
  };

  const toggleSoftware = (sw: string) => {
    setDraft((prev) => {
      const current = prev.supportedSoftware || [];
      const exists = current.includes(sw);
      return {
        ...prev,
        supportedSoftware: exists ? current.filter((item) => item !== sw) : [...current, sw],
      };
    });
  };

  const selectedExt = extractArchiveExtension(draft.fileName);

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>SwxStudios / Owner Studio &amp; Control Panel</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            Owner Admin &amp; Site Controls
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Upload packages, configure BuiltByBit-style resource specifications, manage your catalog, and moderate the site.
          </p>
        </div>

        <button
          type="button"
          onClick={onReturnHome}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 whitespace-nowrap hover:border-zinc-700 hover:text-white"
        >
          View Storefront
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800/90 bg-[#111114] px-4 py-3.5">
          <p className="text-xs text-zinc-400">Published Packages</p>
          <p className="mt-1 text-xl font-bold text-white tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-zinc-800/90 bg-[#111114] px-4 py-3.5">
          <p className="text-xs text-zinc-400">Total Views</p>
          <p className="mt-1 text-xl font-bold text-white tabular-nums">
            {stats.totalViews.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/90 bg-[#111114] px-4 py-3.5">
          <p className="text-xs text-zinc-400">Total Downloads</p>
          <p className="mt-1 text-xl font-bold text-white tabular-nums">
            {stats.totalDownloads.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/90 bg-[#111114] px-4 py-3.5">
          <p className="text-xs text-zinc-400">Community Threads</p>
          <p className="mt-1 text-xl font-bold text-white tabular-nums">{stats.threadsCount}</p>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Owner Admin sections"
        className="mt-6 flex flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={workspaceTab === 'upload'}
          onClick={() => setWorkspaceTab('upload')}
          className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold transition-colors ${
            workspaceTab === 'upload'
              ? 'bg-white text-zinc-950'
              : 'border border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
          }`}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{editingId ? 'Edit Package' : 'Upload & Publish'}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={workspaceTab === 'catalog'}
          onClick={() => setWorkspaceTab('catalog')}
          className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold transition-colors ${
            workspaceTab === 'catalog'
              ? 'bg-white text-zinc-950'
              : 'border border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
          }`}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Catalog Manager ({resources.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={workspaceTab === 'controls'}
          onClick={() => setWorkspaceTab('controls')}
          className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold transition-colors ${
            workspaceTab === 'controls'
              ? 'bg-white text-zinc-950'
              : 'border border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Owner Controls</span>
        </button>
      </div>

      {/* TAB 1: UPLOAD & PUBLISH */}
      {workspaceTab === 'upload' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="lg:col-span-8 rounded-xl border border-zinc-800/90 bg-[#111114] p-5 sm:p-6 space-y-6"
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3.5">
              <div>
                <h2 className="text-base font-bold text-white">
                  {editingId ? 'Edit Published Package' : 'Upload & Configure Resource'}
                </h2>
                <p className="text-xs text-zinc-400">
                  Attach your archive file, configure tier &amp; technical specs, and publish to the catalog.
                </p>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(createEmptyDraft(ownerDisplayName));
                    setFormError(null);
                    setFormSuccess(null);
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* File Dropzone */}
            <div>
              <span className="block text-xs font-medium text-zinc-300">
                Package Archive File
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept={ARCHIVE_ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleSelectedFile(file);
                  e.target.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleSelectedFile(file);
                }}
                disabled={uploading}
                className={`mt-1.5 flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
                  dragActive
                    ? 'border-white bg-zinc-900'
                    : 'border-zinc-700 bg-zinc-950/70 hover:border-zinc-500 hover:bg-zinc-950'
                } disabled:opacity-60`}
              >
                {uploading ? (
                  <>
                    <Upload className="h-6 w-6 animate-bounce text-zinc-300" aria-hidden="true" />
                    <p className="mt-2 text-xs font-semibold text-white">
                      Uploading archive to SwxStudios...
                    </p>
                  </>
                ) : draft.fileName ? (
                  <>
                    <FileArchive className="h-6 w-6 text-emerald-400" aria-hidden="true" />
                    <p className="mt-2 text-xs font-semibold text-white">{draft.fileName}</p>
                    <p className="mt-1 font-display-mono text-[11px] text-zinc-400">
                      {selectedExt ? selectedExt.toUpperCase() : 'ARCHIVE'} · {draft.fileSize} · Click or drop to replace
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-zinc-400" aria-hidden="true" />
                    <p className="mt-2 text-xs font-semibold text-zinc-200">
                      Click to select or drag and drop a package file
                    </p>
                    <p className="mt-1 font-display-mono text-[11px] text-zinc-500">
                      Allowed: .jar · .zip · .rar · .7z · .gz · .tar (up to 100 MB)
                    </p>
                  </>
                )}
              </button>
            </div>

            {/* Basic Metadata */}
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-res-title" className="block text-xs font-medium text-zinc-300">
                    Title
                  </label>
                  <input
                    id="admin-res-title"
                    type="text"
                    maxLength={100}
                    value={draft.title}
                    onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. SwxCombat Pro"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="admin-res-category" className="block text-xs font-medium text-zinc-300">
                    Category
                  </label>
                  <select
                    id="admin-res-category"
                    value={draft.category}
                    onChange={(e) => {
                      const nextCat = e.target.value as CategoryId;
                      setDraft((p) => ({
                        ...p,
                        category: nextCat,
                        resourceType: defaultResourceTypeForCategory(nextCat),
                      }));
                    }}
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="admin-res-subtitle" className="block text-xs font-medium text-zinc-300">
                  Short Subtitle
                </label>
                <input
                  id="admin-res-subtitle"
                  type="text"
                  maxLength={160}
                  value={draft.subtitle}
                  onChange={(e) => setDraft((p) => ({ ...p, subtitle: e.target.value }))}
                  placeholder="One-line summary shown on cards and modal header"
                  className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="admin-res-desc" className="block text-xs font-medium text-zinc-300">
                  Overview Description
                </label>
                <textarea
                  id="admin-res-desc"
                  rows={4}
                  maxLength={3000}
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Detailed overview, setup notes, commands, and permissions..."
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div>
                  <label htmlFor="admin-res-version" className="block text-xs font-medium text-zinc-300">
                    Version
                  </label>
                  <input
                    id="admin-res-version"
                    type="text"
                    maxLength={40}
                    value={draft.version}
                    onChange={(e) => setDraft((p) => ({ ...p, version: e.target.value }))}
                    placeholder="v1.0.0"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="admin-res-mc" className="block text-xs font-medium text-zinc-300">
                    Minecraft Range
                  </label>
                  <input
                    id="admin-res-mc"
                    type="text"
                    maxLength={60}
                    value={draft.mcVersions}
                    onChange={(e) => setDraft((p) => ({ ...p, mcVersions: e.target.value }))}
                    placeholder="1.20.4 - 1.21.4"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="admin-res-author" className="block text-xs font-medium text-zinc-300">
                    Creator / Author
                  </label>
                  <input
                    id="admin-res-author"
                    type="text"
                    maxLength={80}
                    value={draft.author}
                    onChange={(e) => setDraft((p) => ({ ...p, author: e.target.value }))}
                    placeholder="SwxStudios"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Technical Specs Section (matches right sidebar) */}
            <div className="space-y-3.5 border-t border-zinc-800/80 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Technical Specifications &amp; Compatibility
              </h3>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-res-type" className="block text-xs font-medium text-zinc-300">
                    Resource Type
                  </label>
                  <select
                    id="admin-res-type"
                    value={draft.resourceType || 'Plugin'}
                    onChange={(e) => setDraft((p) => ({ ...p, resourceType: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  >
                    {RESOURCE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="admin-res-gamemodes" className="block text-xs font-medium text-zinc-300">
                    Game Modes (comma separated)
                  </label>
                  <input
                    id="admin-res-gamemodes"
                    type="text"
                    value={draft.gameModesText || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, gameModesText: e.target.value }))}
                    placeholder="Survival, BoxPVP, Practice"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-zinc-300">
                  Supported Software
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SOFTWARE_OPTIONS.map((sw) => {
                    const active = (draft.supportedSoftware || []).includes(sw);
                    return (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => toggleSoftware(sw)}
                        aria-pressed={active}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-white bg-white text-zinc-950'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {sw}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-res-supver" className="block text-xs font-medium text-zinc-300">
                    Supported Versions (tags, comma separated)
                  </label>
                  <input
                    id="admin-res-supver"
                    type="text"
                    value={draft.supportedVersionsText || ''}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, supportedVersionsText: e.target.value }))
                    }
                    placeholder="1.21, 1.20"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="admin-res-langs" className="block text-xs font-medium text-zinc-300">
                    Supported Languages (comma separated)
                  </label>
                  <input
                    id="admin-res-langs"
                    type="text"
                    value={draft.supportedLanguagesText || ''}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, supportedLanguagesText: e.target.value }))
                    }
                    placeholder="English, Spanish"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Compliance & AI Disclosure Flags */}
            <div className="space-y-3 border-t border-zinc-800/80 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Compliance &amp; AI Disclosure
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-200">
                  <span>Open source</span>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.openSource)}
                    onChange={(e) => setDraft((p) => ({ ...p, openSource: e.target.checked }))}
                    className="h-4 w-4 accent-white"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-200">
                  <span>DRM-free</span>
                  <input
                    type="checkbox"
                    checked={draft.drmFree !== false}
                    onChange={(e) => setDraft((p) => ({ ...p, drmFree: e.target.checked }))}
                    className="h-4 w-4 accent-white"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-200">
                  <span>Unobfuscated</span>
                  <input
                    type="checkbox"
                    checked={draft.unobfuscated !== false}
                    onChange={(e) => setDraft((p) => ({ ...p, unobfuscated: e.target.checked }))}
                    className="h-4 w-4 accent-white"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-200">
                  <span>AI use in marketing</span>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.aiMarketing)}
                    onChange={(e) => setDraft((p) => ({ ...p, aiMarketing: e.target.checked }))}
                    className="h-4 w-4 accent-white"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-200 sm:col-span-2">
                  <span>AI use in product</span>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.aiProduct)}
                    onChange={(e) => setDraft((p) => ({ ...p, aiProduct: e.target.checked }))}
                    className="h-4 w-4 accent-white"
                  />
                </label>
              </div>
            </div>

            {/* Dependencies, Changelog, Demo Video & Visuals */}
            <div className="space-y-3.5 border-t border-zinc-800/80 pt-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-res-deps" className="block text-xs font-medium text-zinc-300">
                    Dependencies (comma separated)
                  </label>
                  <input
                    id="admin-res-deps"
                    type="text"
                    value={draft.dependenciesText || ''}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, dependenciesText: e.target.value }))
                    }
                    placeholder="Vault, PlaceholderAPI, ProtocolLib"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="admin-res-video" className="block text-xs font-medium text-zinc-300">
                    Demo Video URL (YouTube or showcase)
                  </label>
                  <input
                    id="admin-res-video"
                    type="url"
                    maxLength={500}
                    value={draft.demoVideoUrl || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, demoVideoUrl: e.target.value }))}
                    placeholder="https://youtube.com/watch?v=..."
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-res-artwork" className="block text-xs font-medium text-zinc-300">
                    Card Artwork Theme
                  </label>
                  <select
                    id="admin-res-artwork"
                    value={draft.artwork}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, artwork: e.target.value as ArtworkTheme }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  >
                    {ARTWORK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="admin-res-tags" className="block text-xs font-medium text-zinc-300">
                    Tags (comma separated)
                  </label>
                  <input
                    id="admin-res-tags"
                    type="text"
                    value={draft.tagsText}
                    onChange={(e) => setDraft((p) => ({ ...p, tagsText: e.target.value }))}
                    placeholder="arenareset, nolag, folia"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-res-features" className="block text-xs font-medium text-zinc-300">
                    Included Features (one per line)
                  </label>
                  <textarea
                    id="admin-res-features"
                    rows={3}
                    value={draft.featuresText}
                    onChange={(e) => setDraft((p) => ({ ...p, featuresText: e.target.value }))}
                    placeholder={'Async SQLite & MySQL support\nZero-lag Folia scheduler'}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="admin-res-changelog" className="block text-xs font-medium text-zinc-300">
                    Updates / Changelog (version | date | notes)
                  </label>
                  <textarea
                    id="admin-res-changelog"
                    rows={3}
                    value={draft.changelogText || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, changelogText: e.target.value }))}
                    placeholder={'v1.1.0 | 2026-11-16 | Fixed Folia entity reset\nv1.0.0 | 2026-11-01 | Initial studio release'}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Package Tier & Popular Switch */}
            <div className="space-y-4 border-t border-zinc-800/80 pt-4">
              <div>
                <span className="block text-xs font-medium text-zinc-300">Access Tier</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIER_OPTIONS.map((opt) => {
                    const active = (draft.tier || 'free') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            tier: opt.value as ResourceTier,
                            exclusive: opt.value === 'premium' || opt.value === 'ultimate',
                          }))
                        }
                        aria-pressed={active}
                        className={`rounded-md border px-3 py-2 text-left transition-colors ${
                          active
                            ? 'border-white bg-zinc-900 text-white'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <span className="block text-xs font-bold">{opt.label}</span>
                        <span className="mt-0.5 block text-[10px] text-zinc-500">
                          {opt.summary}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                {(draft.tier === 'paid' || draft.tier === 'ultimate') && (
                  <div className="w-full sm:w-52">
                    <label htmlFor="admin-res-price" className="block text-xs font-medium text-zinc-300">
                      Price Label
                    </label>
                    <input
                      id="admin-res-price"
                      type="text"
                      maxLength={24}
                      value={draft.priceLabel || ''}
                      onChange={(e) => setDraft((p) => ({ ...p, priceLabel: e.target.value }))}
                      placeholder={draft.tier === 'paid' ? '$4.99' : 'Optional ($14.99)'}
                      className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                )}

                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-200">
                  <input
                    type="checkbox"
                    checked={draft.popular}
                    onChange={(e) => setDraft((p) => ({ ...p, popular: e.target.checked }))}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-white"
                  />
                  <Flame className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                  <span>Mark as Popular (Featured)</span>
                </label>
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDraft(createEmptyDraft(ownerDisplayName));
                  setFormError(null);
                  setFormSuccess(null);
                }}
                className="h-10 rounded-md border border-zinc-800 bg-zinc-900 px-4 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white"
              >
                Reset
              </button>

              <button
                type="submit"
                disabled={submitting || uploading}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-5 text-xs font-bold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>
                  {submitting
                    ? editingId
                      ? 'Saving...'
                      : 'Publishing...'
                    : editingId
                    ? 'Save Changes'
                    : 'Publish Resource'}
                </span>
              </button>
            </div>
          </form>

          {/* Right Live Spec & Card Preview */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-zinc-800/90 bg-[#111114] p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Live Storefront Preview
              </p>

              <div className="h-36 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                <ResourceArtwork
                  theme={draft.artwork}
                  title={draft.title || 'SwxStudios Release'}
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="uppercase">{draft.resourceType || 'Plugin'}</span>
                  <span className="font-display-mono">{draft.version || 'v1.0.0'}</span>
                </div>
                <p className="mt-1 text-base font-bold text-white">
                  {draft.title || 'Untitled Release'}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {draft.subtitle || 'Short summary appears on cards and search.'}
                </p>
              </div>

              <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Open source:</span>
                  <span className="text-zinc-200">{draft.openSource ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">DRM-free:</span>
                  <span className="text-zinc-200">{draft.drmFree !== false ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Unobfuscated:</span>
                  <span className="text-zinc-200">
                    {draft.unobfuscated !== false ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">AI in marketing / product:</span>
                  <span className="text-zinc-200">
                    {draft.aiMarketing ? 'Yes' : 'No'} / {draft.aiProduct ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-xs">
                <p className="text-[11px] font-semibold text-zinc-400">Supported Software</p>
                <div className="flex flex-wrap gap-1">
                  {(draft.supportedSoftware || []).length > 0 ? (
                    (draft.supportedSoftware || []).map((sw) => (
                      <span
                        key={sw}
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-200"
                      >
                        {sw}
                      </span>
                    ))
                  ) : (
                    <span className="text-zinc-500">None selected</span>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 2: CATALOG MANAGER */}
      {workspaceTab === 'catalog' && (
        <div className="mt-6 rounded-xl border border-zinc-800/90 bg-[#111114] p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-zinc-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Published Catalog</h2>
              <p className="text-xs text-zinc-400 tabular-nums">
                {filteredResources.length} of {resources.length} packages shown
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={manageQuery}
                  onChange={(e) => setManageQuery(e.target.value)}
                  placeholder="Search title or archive..."
                  aria-label="Filter published resources"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none sm:w-60"
                />
              </div>

              <select
                value={manageCategory}
                onChange={(e) => setManageCategory(e.target.value as CategoryId | 'all')}
                aria-label="Filter published category"
                className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {filteredResources.length === 0 ? (
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-10 text-center">
                <p className="text-sm font-semibold text-zinc-200">
                  {resources.length === 0 ? '0 resources published yet' : 'No matching packages'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {resources.length === 0
                    ? 'Switch to Upload & Publish to add your first package.'
                    : 'Try clearing your search or category filter.'}
                </p>
              </div>
            ) : (
              filteredResources.map((item) => {
                const ext = item.fileExtension || extractArchiveExtension(item.fileName) || 'zip';
                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        <span className="font-display-mono font-semibold uppercase text-zinc-200">
                          {ext}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.resourceType || defaultResourceTypeForCategory(item.category)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{item.fileSize}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold uppercase ${
                            getEffectiveResourceTier(item) === 'ultimate'
                              ? 'text-violet-300'
                              : getEffectiveResourceTier(item) === 'premium'
                              ? 'text-amber-300'
                              : getEffectiveResourceTier(item) === 'paid'
                              ? 'text-sky-300'
                              : 'text-emerald-300'
                          }`}
                        >
                          {getEffectiveResourceTier(item)}
                          {item.priceLabel ? ` (${item.priceLabel})` : ''}
                        </span>
                        {item.popular && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-white">Popular</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-white">{item.title}</p>
                      <p className="truncate font-display-mono text-[11px] text-zinc-500">
                        {item.fileName} · {item.downloads} downloads · {item.views ?? 0} views
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDownloadResource(item)}
                        className="inline-flex h-8 items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Download</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="inline-flex h-8 items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>

                      {isConfirming ? (
                        <>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleConfirmDelete(item)}
                            className="inline-flex h-8 items-center gap-1 rounded border border-red-500/50 bg-red-500/20 px-3 text-xs font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-60"
                          >
                            <span>{isDeleting ? 'Deleting...' : 'Confirm'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="inline-flex h-8 items-center rounded border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label={`Delete ${item.title}`}
                          className="inline-flex h-8 items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: OWNER CONTROLS */}
      {workspaceTab === 'controls' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Site Announcement & Community Access Settings */}
          <form
            onSubmit={handleSaveSettings}
            className="lg:col-span-7 rounded-xl border border-zinc-800/90 bg-[#111114] p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3.5">
              <Megaphone className="h-4 w-4 text-amber-300" aria-hidden="true" />
              <div>
                <h2 className="text-base font-bold text-white">Storefront &amp; Site Controls</h2>
                <p className="text-xs text-zinc-400">
                  Control the top announcement bar and community posting privileges across the site.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-xs font-medium text-zinc-200">
                <span>Show Storefront Announcement Banner</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.announcementVisible}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({ ...p, announcementVisible: e.target.checked }))
                  }
                  className="h-4 w-4 accent-white"
                />
              </label>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div>
                  <label htmlFor="ctrl-ann-label" className="block text-xs font-medium text-zinc-300">
                    Banner Badge Label
                  </label>
                  <input
                    id="ctrl-ann-label"
                    type="text"
                    maxLength={60}
                    value={settingsDraft.announcementLabel}
                    onChange={(e) =>
                      setSettingsDraft((p) => ({ ...p, announcementLabel: e.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ctrl-ann-text" className="block text-xs font-medium text-zinc-300">
                    Announcement Message
                  </label>
                  <input
                    id="ctrl-ann-text"
                    type="text"
                    maxLength={240}
                    value={settingsDraft.announcementText}
                    onChange={(e) =>
                      setSettingsDraft((p) => ({ ...p, announcementText: e.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-xs font-medium text-zinc-200">
                <div>
                  <span className="block">Enable Community Thread Creation</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                    When disabled, members can browse threads but cannot post new topics.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsDraft.communityEnabled}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({ ...p, communityEnabled: e.target.checked }))
                  }
                  className="h-4 w-4 accent-white"
                />
              </label>

              {/* GCash & PayPal Payment Accounts */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-sky-400" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-white">
                      GCash &amp; PayPal Payment Details
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Shown to members when buying Premium, Ultimate, or Paid packages.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ctrl-gcash-name" className="block text-[11px] font-medium text-zinc-300">
                      GCash Account Name
                    </label>
                    <input
                      id="ctrl-gcash-name"
                      type="text"
                      maxLength={80}
                      value={settingsDraft.gcashName || ''}
                      onChange={(e) =>
                        setSettingsDraft((p) => ({ ...p, gcashName: e.target.value }))
                      }
                      placeholder="SwxStudios Owner"
                      className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ctrl-gcash-number" className="block text-[11px] font-medium text-zinc-300">
                      GCash Mobile Number
                    </label>
                    <input
                      id="ctrl-gcash-number"
                      type="text"
                      maxLength={32}
                      value={settingsDraft.gcashNumber || ''}
                      onChange={(e) =>
                        setSettingsDraft((p) => ({ ...p, gcashNumber: e.target.value }))
                      }
                      placeholder="09XX XXX XXXX"
                      className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ctrl-paypal-email" className="block text-[11px] font-medium text-zinc-300">
                      PayPal Email
                    </label>
                    <input
                      id="ctrl-paypal-email"
                      type="email"
                      maxLength={120}
                      value={settingsDraft.paypalEmail || ''}
                      onChange={(e) =>
                        setSettingsDraft((p) => ({ ...p, paypalEmail: e.target.value }))
                      }
                      placeholder="randellemupas@gmail.com"
                      className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ctrl-paypal-link" className="block text-[11px] font-medium text-zinc-300">
                      PayPal.me Link (Optional)
                    </label>
                    <input
                      id="ctrl-paypal-link"
                      type="url"
                      maxLength={240}
                      value={settingsDraft.paypalLink || ''}
                      onChange={(e) =>
                        setSettingsDraft((p) => ({ ...p, paypalLink: e.target.value }))
                      }
                      placeholder="https://paypal.me/..."
                      className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {settingsError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsFeedback && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{settingsFeedback}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-5 text-xs font-bold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>{savingSettings ? 'Saving Settings...' : 'Save Site Controls'}</span>
              </button>
            </div>
          </form>

          {/* Verified Owners + Thread Moderation */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-zinc-800/90 bg-[#111114] p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <h2 className="text-sm font-bold text-white">Verified Owner Roster</h2>
              </div>
              <ul className="space-y-2 text-xs">
                {OWNER_EMAILS.map((email) => {
                  const isCurrent =
                    ownerEmail && ownerEmail.trim().toLowerCase() === email.toLowerCase();
                  return (
                    <li
                      key={email}
                      className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2"
                    >
                      <span className="font-display-mono text-zinc-200">{email}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          isCurrent
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-zinc-900 text-zinc-400'
                        }`}
                      >
                        {isCurrent ? 'Active' : 'Owner'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {onOpenTiersConsole && (
                <button
                  type="button"
                  onClick={onOpenTiersConsole}
                  className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
                >
                  <span>Open PvP Tier List &amp; Commands Console</span>
                </button>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800/90 bg-[#111114] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-sky-400" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-white">Thread Moderation</h2>
                </div>
                <span className="text-xs text-zinc-400 tabular-nums">{threads.length} total</span>
              </div>

              {threads.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-500">
                  No community threads posted yet.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {threads.map((thread) => {
                    const confirming = confirmDeleteThreadId === thread.id;
                    const deleting = deletingThreadId === thread.id;
                    return (
                      <div
                        key={thread.id}
                        className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs"
                      >
                        <p className="truncate font-semibold text-zinc-100">{thread.title}</p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>
                            {thread.author} · {thread.topic}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {confirming ? (
                              <>
                                <button
                                  type="button"
                                  disabled={deleting}
                                  onClick={() => void handleThreadDelete(thread.id)}
                                  className="rounded border border-red-500/50 bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-200"
                                >
                                  {deleting ? 'Removing...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteThreadId(null)}
                                  className="rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteThreadId(thread.id)}
                                aria-label={`Delete thread ${thread.title}`}
                                className="inline-flex items-center gap-1 rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800/90 bg-[#111114] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-white">Server Directory Queue</h2>
                </div>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {servers.filter((s) => !s.approved).length} pending
                </span>
              </div>

              {servers.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-500">
                  No Minecraft servers submitted yet.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {servers.map((srv) => (
                    <div
                      key={srv.id}
                      className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-zinc-100">{srv.name}</span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            srv.approved
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {srv.approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-display-mono text-[11px] text-zinc-500">
                        {srv.address} · {srv.edition}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateServerFlags(srv.id, { approved: !srv.approved })
                          }
                          className="rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-zinc-600"
                        >
                          {srv.approved ? 'Unapprove' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateServerFlags(srv.id, { featured: !srv.featured })
                          }
                          className="inline-flex items-center gap-1 rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-zinc-600"
                        >
                          <Star className="h-3 w-3 text-amber-300" />
                          <span>{srv.featured ? 'Unfeature' : 'Feature'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteServer(srv.id)}
                          className="rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GCash & PayPal Order Verification Queue */}
            <div className="rounded-xl border border-zinc-800/90 bg-[#111114] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-sky-400" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-white">GCash &amp; PayPal Orders</h2>
                </div>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {membershipOrders.filter((o) => o.status === 'pending').length} pending
                </span>
              </div>

              {membershipOrders.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-500">
                  No GCash or PayPal purchase proofs submitted yet.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {membershipOrders.map((ord) => {
                    const busy = resolvingOrderId === ord.id;
                    return (
                      <div
                        key={ord.id}
                        className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-zinc-100">
                            {ord.buyerName} ·{' '}
                            {ord.plan === 'package'
                              ? ord.resourceTitle || 'Paid Package'
                              : ord.plan.toUpperCase()}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              ord.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : ord.status === 'declined'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-display-mono text-[11px] text-zinc-400">
                          {ord.paymentMethod.toUpperCase()} · {ord.amountLabel} · Ref:{' '}
                          {ord.referenceCode}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          From: {ord.senderAccount}
                        </p>
                        {ord.status === 'pending' && onResolveMembershipOrder && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setResolvingOrderId(ord.id);
                                void onResolveMembershipOrder(ord, 'approved').finally(() =>
                                  setResolvingOrderId(null)
                                );
                              }}
                              className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
                            >
                              Approve &amp; Unlock
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setResolvingOrderId(ord.id);
                                void onResolveMembershipOrder(ord, 'declined').finally(() =>
                                  setResolvingOrderId(null)
                                );
                              }}
                              className="rounded border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-red-500/40 hover:text-red-300 disabled:opacity-60"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
