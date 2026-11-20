import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Box,
  Calculator,
  Check,
  Code2,
  Compass,
  Copy,
  Download,
  FileCode2,
  FlaskConical,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Map as MapIcon,
  Palette,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Sprout,
  Swords,
  Terminal,
  Type,
  User,
  UserCheck,
  Users,
  Wand2,
  Warehouse,
  Wrench,
} from 'lucide-react';
import {
  buildLuckPermsCommand,
  calculateEconomyMargin,
  calculateShulkersAndStacks,
  convertOverworldNether,
  convertTextFormat,
  generateHexGradient,
  MC_COLOR_MAP,
  PROBE_REGIONS,
  resolveProbeRegionInfo,
  TextConverterTarget,
  toServerPropertiesMotd,
  validateJsonText,
  validateYamlBasic,
  xpPointsForLevel,
} from '../utils/mcToolsLogic';
import { ProbeRegionId } from '../types';
import { buildMinecraftHeadAvatarUrl } from '../utils/skinLogic';
import { LiveMotdCard, MinecraftFormattedText } from './MinecraftTextPreview';
import { ToolsExtendedPanels } from './ToolsExtendedPanels';

export type ToolId =
  | 'motd'
  | 'fonts'
  | 'colors'
  | 'gradient'
  | 'converter'
  | 'commands'
  | 'seedmap'
  | 'status'
  | 'economy'
  | 'luckperms'
  | 'icon'
  | 'malware'
  | 'nether'
  | 'shulker'
  | 'material'
  | 'skin'
  | 'uuid'
  | 'json'
  | 'yaml'
  | 'potion'
  | 'xp'
  | 'elytra'
  | 'traveltime'
  | 'villager'
  | 'enchant'
  | 'storage'
  | 'gear'
  | 'farming'
  | 'mobfarm'
  | 'spark'
  | 'tab';

export type ToolCategoryFilter =
  | 'all'
  | 'minecraft-tools'
  | 'server-owner'
  | 'player'
  | 'developer'
  | 'performance';

export interface ToolMeta {
  id: ToolId;
  title: string;
  description: string;
  category: Exclude<ToolCategoryFilter, 'all'>;
  categoryLabel: string;
}

export const TOOL_DIRECTORY: ToolMeta[] = [
  {
    id: 'motd',
    title: 'MOTD Generator',
    description: 'Design 2-line server MOTDs with live Multiplayer list preview and server.properties export.',
    category: 'minecraft-tools',
    categoryLabel: 'Minecraft Tools',
  },
  {
    id: 'fonts',
    title: 'Text Font Generator',
    description: 'Convert titles into Small Caps, Gothic, Bold Sans, Circled, and 10 Unicode font designs.',
    category: 'minecraft-tools',
    categoryLabel: 'Minecraft Tools',
  },
  {
    id: 'colors',
    title: 'Color Code Generator',
    description: 'Pick classic & codes and custom 1.16+ RGB HEX values with Bungee &x export.',
    category: 'minecraft-tools',
    categoryLabel: 'Minecraft Tools',
  },
  {
    id: 'gradient',
    title: 'Gradient Maker',
    description: 'Generate smooth 2-stop HEX gradients in &#rrggbb, &x legacy, or MiniMessage syntax.',
    category: 'minecraft-tools',
    categoryLabel: 'Minecraft Tools',
  },
  {
    id: 'converter',
    title: 'Text Format Converter',
    description: 'Translate formatting live between &, section §, MiniMessage, and raw JSON components.',
    category: 'minecraft-tools',
    categoryLabel: 'Minecraft Tools',
  },
  {
    id: 'commands',
    title: 'Command Builder',
    description: 'Generate /give, /summon, /effect, /title, /tp, and /gamerule commands visually.',
    category: 'minecraft-tools',
    categoryLabel: 'Minecraft Tools',
  },
  {
    id: 'seedmap',
    title: 'Seed Map Explorer',
    description: 'Explore chunk biome distributions, village candidates, and exact Java slime chunks.',
    category: 'minecraft-tools',
    categoryLabel: 'Minecraft Tools',
  },
  {
    id: 'status',
    title: 'Server Status Checker',
    description: 'Ping any live Java or Bedrock server address for MOTD, player counts, and software.',
    category: 'server-owner',
    categoryLabel: 'Server Owner',
  },
  {
    id: 'luckperms',
    title: 'LuckPerms Generator',
    description: 'Build /lp group and user permission commands with server, world, and temp durations.',
    category: 'server-owner',
    categoryLabel: 'Server Owner',
  },
  {
    id: 'icon',
    title: 'Server Icon Converter',
    description: 'Center-crop and downscale any image to an exact 64x64 server-icon.png file.',
    category: 'server-owner',
    categoryLabel: 'Server Owner',
  },
  {
    id: 'economy',
    title: 'Economy Calculator',
    description: 'Compute net auction/shop profit per item, per stack, and percentage margin after tax.',
    category: 'server-owner',
    categoryLabel: 'Server Owner',
  },
  {
    id: 'malware',
    title: 'Malware Scanner',
    description: 'Scan local plugin .jar/.zip bytecode for RCE exec hooks, webhooks, and backdoors.',
    category: 'server-owner',
    categoryLabel: 'Server Owner',
  },
  {
    id: 'tab',
    title: 'TAB Animation Maker',
    description: 'Build animated header/footer frames with live interval preview and animations.yml.',
    category: 'server-owner',
    categoryLabel: 'Server Owner',
  },
  {
    id: 'nether',
    title: 'Nether Coordinate Calculator',
    description: 'Convert Overworld and Nether portal coordinates accurately with 8:1 scaling.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'shulker',
    title: 'Shulker & Stack Calculator',
    description: 'Break large item counts into double chests, shulker boxes, stacks, and remainder.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'material',
    title: 'Material List Calculator',
    description: 'Parse multi-line building lists into total blocks, shulkers, stacks, and double chests.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'skin',
    title: 'Skin Viewer & Downloader',
    description: 'Preview 3D player skins by Java username and download raw Minecraft skin PNGs.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'potion',
    title: 'Potion Brewing Guide',
    description: 'Search brewing recipes with Redstone duration extensions and Glowstone II potency.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'xp',
    title: 'XP Level Calculator',
    description: 'Calculate exact Minecraft experience points required to reach any target level.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'elytra',
    title: 'Elytra Flight Planner',
    description: 'Estimate Firework rockets needed, flight time, and cruise speed for Duration 1-3.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'traveltime',
    title: 'Travel Time Comparator',
    description: 'Compare trip durations across walking, boat ice highways, elytra, and Nether 8:1.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'villager',
    title: 'Villager Trading Calculator',
    description: 'Compute exact emerald discounts from zombie cures and Hero of the Village levels.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'enchant',
    title: 'Enchantment Planner',
    description: 'Plan optimal gear enchantments, catch mutual-exclusion conflicts, and estimate XP cost.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'storage',
    title: 'Storage Capacity Planner',
    description: 'Size double chests, single chests, barrels, and shulkers needed for bulk items.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'gear',
    title: 'Gear Protection Planner',
    description: 'Mix armor tiers and Protection levels to compute Armor, Toughness, and Damage Reduction.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'farming',
    title: 'Farming Yield Calculator',
    description: 'Calculate water source coverage, farmland plots, expected crop drops, and bone meal.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'mobfarm',
    title: 'Mob Farm Calculator',
    description: 'Project hourly/AFK drops with Looting 0-III multipliers, shulker storage, and XP.',
    category: 'player',
    categoryLabel: 'Player Utilities',
  },
  {
    id: 'uuid',
    title: 'UUID Lookup',
    description: 'Look up any Java player raw UUID, dashed UUID, and avatar via Mojang API.',
    category: 'developer',
    categoryLabel: 'Developer',
  },
  {
    id: 'json',
    title: 'JSON Formatter & Validator',
    description: 'Validate, pretty-print, or minify plugin configs and raw Minecraft JSON messages.',
    category: 'developer',
    categoryLabel: 'Developer',
  },
  {
    id: 'yaml',
    title: 'YAML Config Validator',
    description: 'Catch tabs, duplicate keys, broken mappings, and unclosed quotes before server reload.',
    category: 'developer',
    categoryLabel: 'Developer',
  },
  {
    id: 'spark',
    title: 'Spark Profiler Analyzer',
    description: 'Diagnose TPS drops, MSPT bottlenecks, heap saturation, and laggy hoppers/entities.',
    category: 'performance',
    categoryLabel: 'Performance',
  },
];

function toolIcon(id: ToolId) {
  switch (id) {
    case 'motd':
      return <Terminal className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'fonts':
      return <Type className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'colors':
    case 'gradient':
      return <Palette className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'converter':
      return <RefreshCw className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'commands':
      return <Wand2 className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'seedmap':
      return <MapIcon className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'luckperms':
      return <KeyRound className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'icon':
      return <ImageIcon className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'status':
      return <Activity className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'malware':
      return <ShieldAlert className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'tab':
      return <Layers className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'uuid':
      return <UserCheck className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'skin':
      return <User className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'json':
      return <Code2 className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'yaml':
      return <FileCode2 className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'nether':
    case 'traveltime':
      return <Compass className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'shulker':
    case 'material':
      return <Box className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'storage':
      return <Warehouse className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'economy':
      return <Calculator className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'xp':
    case 'enchant':
      return <Sparkles className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'potion':
      return <FlaskConical className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'elytra':
      return <Rocket className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'villager':
      return <Users className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'gear':
      return <Shield className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'farming':
      return <Sprout className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'mobfarm':
      return <Swords className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    case 'spark':
      return <BarChart3 className="h-4 w-4 text-rose-400" aria-hidden="true" />;
  }
}

interface ToolsViewProps {
  initialTool?: ToolId;
  initialMode?: 'grid' | 'workbench';
  onNotify?: (message: string) => void;
}

interface ServerStatusResult {
  online: boolean;
  host: string;
  resolvedHost?: string | null;
  ip: string | null;
  port: number;
  edition: 'java' | 'bedrock';
  version: string | null;
  software: string | null;
  pingMs?: number | null;
  probeRegion?: string;
  probeLocation?: string;
  playersOnline: number;
  playersMax: number;
  playerSample?: Array<{ uuid: string; name: string }>;
  motdLines: string[];
  iconBase64: string | null;
  checkedAt?: string;
}

interface UuidLookupResult {
  name: string;
  rawUuid: string;
  dashedUuid: string;
  avatarUrl: string;
  skinRenderUrl: string;
}

export const ToolsView: React.FC<ToolsViewProps> = ({
  initialTool = 'motd',
  initialMode = 'grid',
  onNotify,
}) => {
  const [selectedTool, setSelectedTool] = useState<ToolId>(initialTool);
  const [viewMode, setViewMode] = useState<'grid' | 'workbench'>(initialMode);
  const [categoryFilter, setCategoryFilter] = useState<ToolCategoryFilter>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'az'>('featured');
  const [toolSearch, setToolSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (initialTool) {
      setSelectedTool(initialTool);
    }
  }, [initialTool]);

  useEffect(() => {
    setViewMode(initialMode);
  }, [initialMode]);

  const copyValue = async (key: string, value: string, label = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      onNotify?.(label);
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      onNotify?.('Clipboard permission denied by browser.');
    }
  };

  // --- MOTD Generator State ---
  const [motdLine1, setMotdLine1] = useState(
    '&f&lSWXSTUDIOS &8| &7Custom Plugins & Setups'
  );
  const [motdLine2, setMotdLine2] = useState(
    '&aOnline 1.21.4 &8• &bLifesteal, BoxPVP & Skyblock'
  );
  const [motdActiveLine, setMotdActiveLine] = useState<1 | 2>(1);

  const serverPropsMotd = useMemo(
    () => toServerPropertiesMotd(motdLine1, motdLine2),
    [motdLine1, motdLine2]
  );

  const appendColorCodeToMotd = (code: string) => {
    const prefix = `&${code}`;
    if (motdActiveLine === 1) {
      setMotdLine1((prev) => `${prev}${prefix}`);
    } else {
      setMotdLine2((prev) => `${prev}${prefix}`);
    }
  };

  // --- Gradient Maker State ---
  const [gradText, setGradText] = useState('SwxStudios Network');
  const [gradStartHex, setGradStartHex] = useState('#ffffff');
  const [gradEndHex, setGradEndHex] = useState('#e11d48');
  const [gradFormat, setGradFormat] = useState<'ampersand' | 'legacy' | 'minimessage'>('ampersand');
  const [gradBold, setGradBold] = useState(true);

  const gradientResult = useMemo(
    () => generateHexGradient(gradText, gradStartHex, gradEndHex, gradFormat, gradBold),
    [gradText, gradStartHex, gradEndHex, gradFormat, gradBold]
  );

  // --- Text Format Converter State ---
  const [convInput, setConvInput] = useState('&b&lSwxStudios &7— &aPaper 1.21.4');
  const [convTarget, setConvTarget] = useState<TextConverterTarget>('minimessage');
  const convertedOutput = useMemo(
    () => convertTextFormat(convInput, convTarget),
    [convInput, convTarget]
  );

  // --- LuckPerms Generator State ---
  const [lpTargetType, setLpTargetType] = useState<'group' | 'user'>('group');
  const [lpTargetName, setLpTargetName] = useState('vip');
  const [lpNode, setLpNode] = useState('essentials.fly');
  const [lpValue, setLpValue] = useState<'true' | 'false'>('true');
  const [lpServer, setLpServer] = useState('');
  const [lpWorld, setLpWorld] = useState('');
  const [lpDuration, setLpDuration] = useState('');

  const lpCommand = useMemo(
    () =>
      buildLuckPermsCommand({
        targetType: lpTargetType,
        targetName: lpTargetName,
        node: lpNode,
        value: lpValue,
        server: lpServer,
        world: lpWorld,
        duration: lpDuration,
      }),
    [lpTargetType, lpTargetName, lpNode, lpValue, lpServer, lpWorld, lpDuration]
  );

  // --- 64x64 Icon Maker State ---
  const iconCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const iconFileInputRef = useRef<HTMLInputElement | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [iconSourceName, setIconSourceName] = useState<string>('default');

  const handleIconFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      onNotify?.('Please upload a PNG, JPG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = iconCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, 64, 64);
        const side = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - side) / 2);
        const sy = Math.floor((img.height - side) / 2);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 64, 64);

        const pngDataUrl = canvas.toDataURL('image/png');
        setIconPreviewUrl(pngDataUrl);
        setIconSourceName(file.name);
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadIcon = () => {
    if (!iconPreviewUrl) return;
    const link = document.createElement('a');
    link.href = iconPreviewUrl;
    link.download = 'server-icon.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify?.('Downloaded 64x64 server-icon.png');
  };

  // --- Server Status Checker State ---
  const [statusHost, setStatusHost] = useState('donutsmp.net');
  const [statusEdition, setStatusEdition] = useState<'java' | 'bedrock'>('java');
  const [statusRegion, setStatusRegion] = useState<ProbeRegionId>('asia');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<ServerStatusResult | null>(null);
  const statusAutoCheckedRef = useRef(false);

  const runStatusCheck = async (
    targetHost: string,
    edition: 'java' | 'bedrock',
    fresh = false,
    regionOverride?: ProbeRegionId
  ) => {
    const trimmed = targetHost.trim();
    if (!trimmed) {
      setStatusError('Enter a valid Minecraft server IP or domain.');
      return;
    }
    const targetRegion = regionOverride || statusRegion;
    setStatusHost(trimmed);
    setStatusError(null);
    setStatusLoading(true);
    try {
      const res = await fetch(
        `/api/mc/status?host=${encodeURIComponent(trimmed)}&edition=${edition}&region=${encodeURIComponent(targetRegion)}${fresh ? '&fresh=1' : ''}`
      );
      const data = (await res.json()) as ServerStatusResult & { error?: string };
      if (!res.ok) {
        setStatusResult(null);
        setStatusError(data.error || 'Could not query server status.');
      } else {
        setStatusResult(data);
      }
    } catch {
      setStatusResult(null);
      setStatusError('Network error while checking server status.');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (
      viewMode === 'workbench' &&
      selectedTool === 'status' &&
      !statusAutoCheckedRef.current &&
      !statusResult
    ) {
      statusAutoCheckedRef.current = true;
      void runStatusCheck(statusHost, statusEdition, false);
    }
  }, [viewMode, selectedTool, statusResult, statusHost, statusEdition]);

  const handleCheckServerStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    await runStatusCheck(statusHost, statusEdition, true);
  };

  // --- UUID Lookup State ---
  const [uuidUsername, setUuidUsername] = useState('Notch');
  const [uuidLoading, setUuidLoading] = useState(false);
  const [uuidError, setUuidError] = useState<string | null>(null);
  const [uuidResult, setUuidResult] = useState<UuidLookupResult | null>(null);
  const uuidAutoCheckedRef = useRef(false);

  const runUuidLookup = async (username: string) => {
    const clean = username.trim();
    if (!clean) return;
    setUuidUsername(clean);
    setUuidError(null);
    setUuidLoading(true);
    try {
      const res = await fetch(`/api/mc/uuid/${encodeURIComponent(clean)}`);
      const data = (await res.json()) as UuidLookupResult & { error?: string };
      if (!res.ok) {
        setUuidResult(null);
        setUuidError(data.error || 'Player lookup failed.');
      } else {
        setUuidResult(data);
      }
    } catch {
      setUuidResult(null);
      setUuidError('Network error reaching UUID lookup endpoint.');
    } finally {
      setUuidLoading(false);
    }
  };

  useEffect(() => {
    if (
      viewMode === 'workbench' &&
      selectedTool === 'uuid' &&
      !uuidAutoCheckedRef.current &&
      !uuidResult
    ) {
      uuidAutoCheckedRef.current = true;
      void runUuidLookup(uuidUsername);
    }
  }, [viewMode, selectedTool, uuidResult, uuidUsername]);

  const handleLookupUuid = async (e: React.FormEvent) => {
    e.preventDefault();
    await runUuidLookup(uuidUsername);
  };

  // --- JSON & YAML Validators State ---
  const [jsonInput, setJsonInput] = useState('{"text":"SwxStudios","color":"aqua","bold":true}');
  const [jsonMinify, setJsonMinify] = useState(false);
  const jsonResult = useMemo(() => validateJsonText(jsonInput), [jsonInput]);

  const [yamlInput, setYamlInput] = useState(
    'server:\n  name: "SwxStudios"\n  max-players: 100\nfeatures:\n  - async-reset\n  - folia-ready'
  );
  const yamlResult = useMemo(() => validateYamlBasic(yamlInput), [yamlInput]);

  // --- Player Math Calculators State ---
  const [netherFrom, setNetherFrom] = useState<'overworld' | 'nether'>('overworld');
  const [coordX, setCoordX] = useState('800');
  const [coordZ, setCoordZ] = useState('-1600');
  const netherConverted = useMemo(
    () => convertOverworldNether(Number(coordX) || 0, Number(coordZ) || 0, netherFrom),
    [coordX, coordZ, netherFrom]
  );

  const [itemCount, setItemCount] = useState('4608');
  const [stackSize, setStackSize] = useState(64);
  const shulkerResult = useMemo(
    () => calculateShulkersAndStacks(Number(itemCount) || 0, stackSize),
    [itemCount, stackSize]
  );

  const [buyPrice, setBuyPrice] = useState('100');
  const [sellPrice, setSellPrice] = useState('160');
  const [taxPct, setTaxPct] = useState('5');
  const economyResult = useMemo(
    () =>
      calculateEconomyMargin(
        Number(buyPrice) || 0,
        Number(sellPrice) || 0,
        Number(taxPct) || 0
      ),
    [buyPrice, sellPrice, taxPct]
  );

  const [xpLevel, setXpLevel] = useState('30');
  const xpTotal = useMemo(() => xpPointsForLevel(Number(xpLevel) || 0), [xpLevel]);

  const filteredTools = useMemo(() => {
    const q = toolSearch.trim().toLowerCase();
    const list = TOOL_DIRECTORY.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      );
    });
    if (sortBy === 'az') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [categoryFilter, toolSearch, sortBy]);

  const activeMeta = TOOL_DIRECTORY.find((t) => t.id === selectedTool) ?? TOOL_DIRECTORY[0];

  const openToolWorkbench = (id: ToolId) => {
    setSelectedTool(id);
    setViewMode('workbench');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-display-mono text-xs font-medium text-rose-400">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{TOOL_DIRECTORY.length} Minecraft Tools</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Minecraft Tools
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            MOTD maker, font &amp; gradient generators, command builder, seed map, JAR scanner, skin viewer, and calculators.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap shrink-0 items-center gap-2">
          <div className="relative w-full sm:w-48">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <label htmlFor="tools-search-input" className="sr-only">
              Filter utilities
            </label>
            <input
              id="tools-search-input"
              type="search"
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
              placeholder={`Filter ${TOOL_DIRECTORY.length} tools...`}
              className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
            />
          </div>

          <select
            aria-label="Sort tools"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'featured' | 'az')}
            className="h-9 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-200 focus:border-rose-500 focus:outline-none"
          >
            <option value="featured">Recommended</option>
            <option value="az">Name A–Z</option>
          </select>

          {viewMode === 'workbench' && (
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 whitespace-nowrap hover:border-rose-500/60 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>All {TOOL_DIRECTORY.length} Tools</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Strip */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Tool categories">
        {(
          [
            { id: 'all', label: `All (${TOOL_DIRECTORY.length})` },
            { id: 'minecraft-tools', label: 'Minecraft Tools' },
            { id: 'server-owner', label: 'Server Owner' },
            { id: 'player', label: 'Player Utilities' },
            { id: 'developer', label: 'Developer' },
            { id: 'performance', label: 'Performance' },
          ] as { id: ToolCategoryFilter; label: string }[]
        ).map((tab) => {
          const active = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategoryFilter(tab.id)}
              className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
                active
                  ? 'border-rose-500 bg-rose-600 text-white'
                  : 'border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {viewMode === 'grid' ? (
        /* Minevex-Style Clean 3-Column Utility Directory Grid */
        <div className="mt-6">
          {filteredTools.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-[#111114] p-8 text-center text-xs text-zinc-500">
              No tools match your search or category filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => openToolWorkbench(tool.id)}
                  className="group flex flex-col justify-between rounded-lg border border-zinc-800/90 bg-[#111114] p-4 text-left transition-colors hover:border-rose-500/70 hover:bg-zinc-900/70"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950">
                        {toolIcon(tool.id)}
                      </div>
                      <span className="font-display-mono text-[10px] uppercase tracking-wider text-zinc-500">
                        {tool.categoryLabel}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-sm font-bold text-white group-hover:text-rose-200">
                      {tool.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                      {tool.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-zinc-800/70 pt-2.5 text-[11px] font-semibold text-zinc-400 group-hover:text-rose-300">
                    <span>Launch tool</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Focused Split Tool Workbench */
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Selector Rail (appears below active workbench on mobile) */}
          <aside className="order-2 lg:order-1 lg:col-span-4 space-y-2 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:pr-1">
            {filteredTools.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-[#111114] p-6 text-center text-xs text-zinc-500">
                No tools match your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {filteredTools.map((tool) => {
                  const active = selectedTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        setSelectedTool(tool.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      aria-current={active ? 'true' : undefined}
                      className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                        active
                          ? 'border-rose-500/80 bg-zinc-900 text-white'
                          : 'border-zinc-800/80 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950">
                        {toolIcon(tool.id)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold">{tool.title}</span>
                          <span className={`font-display-mono shrink-0 text-[10px] ${active ? 'text-rose-400' : 'text-zinc-500'}`}>
                            {tool.categoryLabel}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                          {tool.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Right Interactive Workbench */}
          <div className="order-1 lg:order-2 lg:col-span-8 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-xl border border-zinc-800/90 bg-[#111114] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-1.5 font-display-mono text-[11px] uppercase tracking-wider text-zinc-500">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className="text-rose-400 hover:underline"
                    >
                      Tools
                    </button>
                    <span>/</span>
                    <span>{activeMeta.categoryLabel}</span>
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-white">{activeMeta.title}</h2>
                  <p className="mt-0.5 text-xs text-zinc-400">{activeMeta.description}</p>
                </div>
              </div>

              {/* 1. MOTD GENERATOR */}
              {selectedTool === 'motd' && (
                <div className="mt-5 space-y-5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-zinc-500">Templates:</span>
                    {[
                      {
                        label: 'SwxStudios Small Caps',
                        l1: '&c&lꜱᴡxꜱᴛᴜᴅɪᴏꜱ &8| &fɴᴇᴛᴡᴏʀᴋ 1.21.4',
                        l2: '&aSurvival · BoxPVP &8• &7play.swxstudios.net',
                      },
                      {
                        label: 'Season Launch Gradient',
                        l1: '&#e11d48&lSEASON 4 NOW LIVE &8| &fCrossplay 1.21',
                        l2: '&e2× Crate Keys Weekend &8• &bJoin Now!',
                      },
                      {
                        label: 'Minimal SMP',
                        l1: '&f&lPure SMP &7— &aSemi-Vanilla Survival',
                        l2: '&7Zero Pay-to-Win &8| &fTPS 20.0 &8| &eNA/EU',
                      },
                    ].map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => {
                          setMotdLine1(tpl.l1);
                          setMotdLine2(tpl.l2);
                        }}
                        className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-medium text-zinc-300 hover:border-rose-500/60 hover:text-white"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>

                  <LiveMotdCard
                    serverName="SwxStudios Network"
                    address="play.swxstudios.net"
                    line1={motdLine1}
                    line2={motdLine2}
                    iconUrl={iconPreviewUrl}
                  />

                  <div>
                    <span className="block text-[11px] font-semibold text-zinc-400">
                      Insert formatting code into Line {motdActiveLine}
                    </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(MC_COLOR_MAP).map(([code, info]) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => appendColorCodeToMotd(code)}
                        title={`&${code} (${info.name})`}
                        className="inline-flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 font-display-mono text-[11px] text-zinc-200 hover:border-zinc-600"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-white/20"
                          style={{ backgroundColor: info.hex }}
                        />
                        <span>&amp;{code}</span>
                      </button>
                    ))}
                    {[
                      { code: 'l', label: 'Bold' },
                      { code: 'o', label: 'Italic' },
                      { code: 'n', label: 'Underline' },
                      { code: 'r', label: 'Reset' },
                    ].map((st) => (
                      <button
                        key={st.code}
                        type="button"
                        onClick={() => appendColorCodeToMotd(st.code)}
                        className="inline-flex h-7 items-center rounded border border-zinc-700 bg-zinc-900 px-2 font-display-mono text-[11px] text-zinc-200 hover:border-zinc-500"
                      >
                        &amp;{st.code} {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label htmlFor="motd-line-1" className="block text-xs font-medium text-zinc-300">
                      MOTD Line 1
                    </label>
                    <input
                      id="motd-line-1"
                      type="text"
                      value={motdLine1}
                      onFocus={() => setMotdActiveLine(1)}
                      onChange={(e) => setMotdLine1(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="motd-line-2" className="block text-xs font-medium text-zinc-300">
                      MOTD Line 2
                    </label>
                    <input
                      id="motd-line-2"
                      type="text"
                      value={motdLine2}
                      onFocus={() => setMotdActiveLine(2)}
                      onChange={(e) => setMotdLine2(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display-mono text-[11px] text-zinc-400">
                      server.properties output
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void copyValue('motd-props', serverPropsMotd, 'Copied server.properties MOTD')
                      }
                      className="inline-flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-600"
                    >
                      {copiedKey === 'motd-props' ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedKey === 'motd-props' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="mt-2 overflow-x-auto font-display-mono text-xs text-zinc-200 whitespace-pre-wrap break-all">
                    {serverPropsMotd}
                  </pre>
                </div>
              </div>
            )}

            {/* 2. COLOR & GRADIENT MAKER */}
            {selectedTool === 'gradient' && (
              <div className="mt-5 space-y-5">
                <div className="rounded-lg border border-zinc-800 bg-[#0b0b0e] p-5 text-center">
                  <p className="font-display-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Live Gradient Output
                  </p>
                  <div className="mt-2 text-2xl tracking-tight">
                    <MinecraftFormattedText text={gradientResult.ampersandPreview || 'Type text below'} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="grad-text" className="block text-xs font-medium text-zinc-300">
                      Text
                    </label>
                    <input
                      id="grad-text"
                      type="text"
                      value={gradText}
                      onChange={(e) => setGradText(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="grad-start" className="block text-xs font-medium text-zinc-300">
                      Start Color
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        id="grad-start"
                        type="color"
                        value={gradStartHex}
                        onChange={(e) => setGradStartHex(e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded border border-zinc-800 bg-zinc-950 p-1"
                      />
                      <input
                        type="text"
                        value={gradStartHex}
                        onChange={(e) => setGradStartHex(e.target.value)}
                        aria-label="Start HEX value"
                        className="h-10 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="grad-end" className="block text-xs font-medium text-zinc-300">
                      End Color
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        id="grad-end"
                        type="color"
                        value={gradEndHex}
                        onChange={(e) => setGradEndHex(e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded border border-zinc-800 bg-zinc-950 p-1"
                      />
                      <input
                        type="text"
                        value={gradEndHex}
                        onChange={(e) => setGradEndHex(e.target.value)}
                        aria-label="End HEX value"
                        className="h-10 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'ampersand', label: '&#rrggbb' },
                        { id: 'legacy', label: '&x Legacy' },
                        { id: 'minimessage', label: 'MiniMessage' },
                      ] as const
                    ).map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setGradFormat(fmt.id)}
                        className={`h-8 rounded-md border px-3 text-xs font-semibold ${
                          gradFormat === fmt.id
                            ? 'border-rose-500 bg-rose-600 text-white'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={gradBold}
                      onChange={(e) => setGradBold(e.target.checked)}
                      className="h-4 w-4 accent-white"
                    />
                    <span>Bold (&amp;l)</span>
                  </label>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display-mono text-[11px] text-zinc-400">
                      Generated Code
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void copyValue('grad-out', gradientResult.output, 'Copied gradient string')
                      }
                      className="inline-flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-600"
                    >
                      {copiedKey === 'grad-out' ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedKey === 'grad-out' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="mt-2 max-h-40 overflow-y-auto font-display-mono text-xs text-zinc-200 whitespace-pre-wrap break-all">
                    {gradientResult.output}
                  </pre>
                </div>
              </div>
            )}

            {/* 3. TEXT FORMAT CONVERTER */}
            {selectedTool === 'converter' && (
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="conv-input" className="block text-xs font-medium text-zinc-300">
                    Input Text (&amp;, §, or &lt;minimessage&gt;)
                  </label>
                  <textarea
                    id="conv-input"
                    rows={3}
                    value={convInput}
                    onChange={(e) => setConvInput(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-md border border-zinc-800 bg-[#0b0b0e] px-3.5 py-2.5 text-sm">
                  <span className="mr-2 font-display-mono text-[10px] uppercase text-zinc-500">
                    Preview:
                  </span>
                  <MinecraftFormattedText
                    text={convertTextFormat(convInput, 'ampersand')}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'ampersand', label: '& Ampersand' },
                      { id: 'section', label: '§ Section' },
                      { id: 'minimessage', label: 'MiniMessage' },
                      { id: 'json', label: 'Minecraft JSON' },
                    ] as const
                  ).map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setConvTarget(target.id)}
                      className={`h-8 rounded-md border px-3 text-xs font-semibold ${
                        convTarget === target.id
                          ? 'border-rose-500 bg-rose-600 text-white'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                      }`}
                    >
                      {target.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display-mono text-[11px] text-zinc-400">
                      Converted Output
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void copyValue('conv-out', convertedOutput, 'Copied converted text')
                      }
                      className="inline-flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-600"
                    >
                      {copiedKey === 'conv-out' ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedKey === 'conv-out' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="mt-2 max-h-52 overflow-y-auto font-display-mono text-xs text-zinc-200 whitespace-pre-wrap break-all">
                    {convertedOutput}
                  </pre>
                </div>
              </div>
            )}

            {/* 4. LUCKPERMS COMMAND BUILDER */}
            {selectedTool === 'luckperms' && (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-500">Presets:</span>
                  {[
                    { label: 'VIP Flight', type: 'group' as const, name: 'vip', node: 'essentials.fly', val: 'true' as const, dur: '' },
                    { label: 'Mod Mute (7d)', type: 'group' as const, name: 'mod', node: 'essentials.mute', val: 'true' as const, dur: '7d' },
                    { label: 'Builder WorldEdit', type: 'group' as const, name: 'builder', node: 'worldedit.*', val: 'true' as const, dur: '' },
                    { label: 'Admin Full *', type: 'group' as const, name: 'admin', node: '*', val: 'true' as const, dur: '' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setLpTargetType(p.type);
                        setLpTargetName(p.name);
                        setLpNode(p.node);
                        setLpValue(p.val);
                        setLpDuration(p.dur);
                      }}
                      className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-medium text-zinc-300 hover:border-rose-500/60 hover:text-white"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <span className="block text-xs font-medium text-zinc-300">Target Type</span>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {(['group', 'user'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setLpTargetType(t)}
                          className={`h-10 rounded-md border text-xs font-semibold capitalize ${
                            lpTargetType === t
                              ? 'border-rose-500 bg-rose-600 text-white'
                              : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lp-target" className="block text-xs font-medium text-zinc-300">
                      {lpTargetType === 'group' ? 'Group Name' : 'Player Username'}
                    </label>
                    <input
                      id="lp-target"
                      type="text"
                      value={lpTargetName}
                      onChange={(e) => setLpTargetName(e.target.value)}
                      placeholder={lpTargetType === 'group' ? 'vip' : 'Steve'}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="lp-node" className="block text-xs font-medium text-zinc-300">
                      Permission Node
                    </label>
                    <input
                      id="lp-node"
                      type="text"
                      value={lpNode}
                      onChange={(e) => setLpNode(e.target.value)}
                      placeholder="essentials.fly"
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-medium text-zinc-300">Value</span>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {(['true', 'false'] as const).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setLpValue(val)}
                          className={`h-10 rounded-md border font-display-mono text-xs font-semibold ${
                            lpValue === val
                              ? 'border-rose-500 bg-rose-600 text-white'
                              : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lp-duration" className="block text-xs font-medium text-zinc-300">
                      Temp Duration (optional, e.g. 7d)
                    </label>
                    <input
                      id="lp-duration"
                      type="text"
                      value={lpDuration}
                      onChange={(e) => setLpDuration(e.target.value)}
                      placeholder="Leave blank for permanent"
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="lp-server" className="block text-xs font-medium text-zinc-300">
                        Server Context
                      </label>
                      <input
                        id="lp-server"
                        type="text"
                        value={lpServer}
                        onChange={(e) => setLpServer(e.target.value)}
                        placeholder="survival"
                        className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>
                    <div>
                      <label htmlFor="lp-world" className="block text-xs font-medium text-zinc-300">
                        World Context
                      </label>
                      <input
                        id="lp-world"
                        type="text"
                        value={lpWorld}
                        onChange={(e) => setLpWorld(e.target.value)}
                        placeholder="world_nether"
                        className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display-mono text-[11px] text-zinc-400">
                      Generated Command
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyValue('lp-cmd', lpCommand, 'Copied LuckPerms command')}
                      className="inline-flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-600"
                    >
                      {copiedKey === 'lp-cmd' ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedKey === 'lp-cmd' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="mt-2 font-display-mono text-xs text-emerald-300 break-all">
                    {lpCommand}
                  </p>
                </div>
              </div>
            )}

            {/* 5. 64x64 SERVER ICON MAKER */}
            {selectedTool === 'icon' && (
              <div className="mt-5 space-y-5">
                <input
                  ref={iconFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleIconFile(f);
                    e.target.value = '';
                  }}
                />
                <canvas ref={iconCanvasRef} width={64} height={64} className="hidden" />

                <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/70 p-6 sm:flex-row">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-700 bg-zinc-900">
                      {iconPreviewUrl ? (
                        <img
                          src={iconPreviewUrl}
                          alt="64x64 preview"
                          className="h-16 w-16 object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-zinc-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {iconPreviewUrl
                          ? `Ready: server-icon.png (64x64 from ${iconSourceName})`
                          : 'Upload any logo or screenshot'}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Automatically center-cropped and exported as exact 64x64 PNG required by Minecraft Java servers.
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => iconFileInputRef.current?.click()}
                      className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3.5 text-xs font-semibold text-zinc-100 hover:border-zinc-500"
                    >
                      Choose Image
                    </button>
                    <button
                      type="button"
                      disabled={!iconPreviewUrl}
                      onClick={handleDownloadIcon}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-rose-600 px-3.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PNG</span>
                    </button>
                  </div>
                </div>

                <LiveMotdCard
                  serverName="My Minecraft Server"
                  address="play.example.com"
                  line1={motdLine1}
                  line2={motdLine2}
                  iconUrl={iconPreviewUrl}
                />
              </div>
            )}

            {/* 6. LIVE SERVER STATUS CHECKER */}
            {selectedTool === 'status' && (
              <div className="mt-5 space-y-5">
                <form onSubmit={handleCheckServerStatus} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={statusHost}
                    onChange={(e) => setStatusHost(e.target.value)}
                    placeholder="donutsmp.net"
                    aria-label="Minecraft server address"
                    className="h-10 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 focus:border-rose-500 focus:outline-none"
                  />
                  <select
                    value={statusEdition}
                    onChange={(e) => setStatusEdition(e.target.value as 'java' | 'bedrock')}
                    aria-label="Server edition"
                    className="h-10 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200"
                  >
                    <option value="java">Java Edition</option>
                    <option value="bedrock">Bedrock Edition</option>
                  </select>
                  <select
                    value={statusRegion}
                    onChange={(e) => {
                      const next = e.target.value as ProbeRegionId;
                      setStatusRegion(next);
                      void runStatusCheck(statusHost, statusEdition, true, next);
                    }}
                    aria-label="Probe location"
                    className="h-10 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-emerald-300"
                  >
                    {PROBE_REGIONS.map((region) => (
                      <option key={region.id} value={region.id} className="bg-zinc-950 text-zinc-100">
                        {region.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={statusLoading}
                    className="h-10 rounded-md bg-rose-600 px-5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
                  >
                    {statusLoading ? 'Pinging...' : 'Check Status'}
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-500">Live Servers:</span>
                  {[
                    'donutsmp.net',
                    'mcpvp.club',
                    'acersmp.xyz',
                    'play.hypixel.net',
                  ].map((hostPreset) => (
                    <button
                      key={hostPreset}
                      type="button"
                      onClick={() => void runStatusCheck(hostPreset, 'java', true)}
                      className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-display-mono text-zinc-300 hover:border-rose-500/60 hover:text-white"
                    >
                      {hostPreset}
                    </button>
                  ))}
                </div>

                {statusError && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    {statusError}
                  </div>
                )}

                {statusResult && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {statusResult.iconBase64 && (
                          <img
                            src={statusResult.iconBase64}
                            alt="Server icon"
                            className="h-12 w-12 rounded border border-zinc-800"
                          />
                        )}
                        <div>
                          <p className="font-display-mono text-sm font-bold text-white">
                            {statusResult.host}:{statusResult.port}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {statusResult.software || statusResult.edition.toUpperCase()} ·{' '}
                            {statusResult.version || 'Unknown version'} ·{' '}
                            <span className="text-emerald-300">
                              {statusResult.probeLocation || resolveProbeRegionInfo(statusRegion).label}
                            </span>
                            {statusResult.resolvedHost && statusResult.resolvedHost !== statusResult.host
                              ? ` · SRV ${statusResult.resolvedHost}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded px-2.5 py-1 font-semibold ${
                            statusResult.online
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {statusResult.online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                        {statusResult.online && typeof statusResult.pingMs === 'number' && (
                          <span className="rounded border border-zinc-800 bg-[#0b0b0e] px-2.5 py-1 font-display-mono text-emerald-300 tabular-nums">
                            {statusResult.pingMs}ms ping
                          </span>
                        )}
                        {statusResult.online && (
                          <span className="font-display-mono text-zinc-200 tabular-nums">
                            {statusResult.playersOnline.toLocaleString()} /{' '}
                            {statusResult.playersMax.toLocaleString()} players
                          </span>
                        )}
                      </div>
                    </div>

                    {statusResult.motdLines.length > 0 && (
                      <div className="rounded border border-zinc-800 bg-[#0b0b0e] p-3 font-display-mono text-xs space-y-1">
                        {statusResult.motdLines.map((line, i) => (
                          <div key={i}>
                            <MinecraftFormattedText text={line} />
                          </div>
                        ))}
                      </div>
                    )}

                    {statusResult.online &&
                      statusResult.playerSample &&
                      statusResult.playerSample.length > 0 && (
                        <div className="rounded border border-zinc-800 bg-[#0b0b0e] p-3">
                          <p className="text-[11px] font-semibold text-zinc-400 mb-2">
                            Live Player Sample ({statusResult.playerSample.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {statusResult.playerSample.slice(0, 18).map((p, idx) => (
                              <div
                                key={`${p.uuid || p.name}-${idx}`}
                                className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200"
                              >
                                <img
                                  src={buildMinecraftHeadAvatarUrl(p.name, { size: 20 })}
                                  alt={p.name}
                                  className="h-4 w-4 rounded-sm"
                                  loading="lazy"
                                />
                                <span className="font-display-mono">{p.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}

            {/* 7. UUID & SKIN LOOKUP */}
            {selectedTool === 'uuid' && (
              <div className="mt-5 space-y-5">
                <form onSubmit={handleLookupUuid} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={uuidUsername}
                    onChange={(e) => setUuidUsername(e.target.value)}
                    placeholder="Enter Java username (e.g. Notch)"
                    aria-label="Minecraft Java username"
                    className="h-10 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={uuidLoading}
                    className="h-10 rounded-md bg-rose-600 px-5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
                  >
                    {uuidLoading ? 'Searching...' : 'Lookup UUID'}
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-500">Quick Players:</span>
                  {['Notch', 'Dinnerbone', 'Dream', 'Technoblade'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void runUuidLookup(p)}
                      className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-display-mono text-zinc-300 hover:border-rose-500/60 hover:text-white"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {uuidError && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    {uuidError}
                  </div>
                )}

                {uuidResult && (
                  <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 sm:flex-row sm:items-center">
                    <img
                      src={uuidResult.skinRenderUrl}
                      alt={`${uuidResult.name} skin`}
                      onError={(e) => {
                        const fallback = buildMinecraftHeadAvatarUrl(uuidResult.name, {
                          size: 160,
                          style: '3d',
                        });
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                      className="h-36 w-auto shrink-0 rounded border border-zinc-800 bg-[#0b0b0e] p-2 object-contain"
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={buildMinecraftHeadAvatarUrl(uuidResult.name, { size: 64 })}
                          alt=""
                          className="h-8 w-8 rounded border border-zinc-700"
                        />
                        <p className="text-base font-bold text-white">{uuidResult.name}</p>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-[#0b0b0e] px-3 py-2">
                          <span className="truncate font-display-mono text-zinc-200">
                            {uuidResult.dashedUuid}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void copyValue('uuid-dash', uuidResult.dashedUuid, 'Copied dashed UUID')
                            }
                            className="shrink-0 text-[11px] font-semibold text-zinc-300 hover:text-white"
                          >
                            {copiedKey === 'uuid-dash' ? 'Copied' : 'Copy Dashed'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-[#0b0b0e] px-3 py-2">
                          <span className="truncate font-display-mono text-zinc-400">
                            {uuidResult.rawUuid}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void copyValue('uuid-raw', uuidResult.rawUuid, 'Copied raw UUID')
                            }
                            className="shrink-0 text-[11px] font-semibold text-zinc-300 hover:text-white"
                          >
                            {copiedKey === 'uuid-raw' ? 'Copied' : 'Copy Raw'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 8. JSON FORMATTER & VALIDATOR */}
            {selectedTool === 'json' && (
              <div className="mt-5 space-y-4">
                <textarea
                  rows={6}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  aria-label="JSON input"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`font-display-mono text-xs font-semibold ${
                      jsonResult.valid ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {jsonResult.valid ? 'Valid JSON' : jsonResult.error}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setJsonMinify((m) => !m)}
                      className="h-8 rounded border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300 hover:border-zinc-600"
                    >
                      {jsonMinify ? 'Pretty Print (2 spaces)' : 'Minify'}
                    </button>
                    <button
                      type="button"
                      disabled={!jsonResult.valid}
                      onClick={() =>
                        void copyValue(
                          'json-out',
                          jsonMinify ? jsonResult.minified : jsonResult.formatted,
                          'Copied formatted JSON'
                        )
                      }
                      className="h-8 rounded bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40"
                    >
                      {copiedKey === 'json-out' ? 'Copied' : 'Copy Output'}
                    </button>
                  </div>
                </div>

                {jsonResult.valid && (
                  <pre className="max-h-56 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-zinc-200">
                    {jsonMinify ? jsonResult.minified : jsonResult.formatted}
                  </pre>
                )}
              </div>
            )}

            {/* 9. YAML CONFIG VALIDATOR */}
            {selectedTool === 'yaml' && (
              <div className="mt-5 space-y-4">
                <textarea
                  rows={8}
                  value={yamlInput}
                  onChange={(e) => setYamlInput(e.target.value)}
                  aria-label="YAML config input"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
                />

                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold ${
                      yamlResult.valid ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {yamlResult.valid
                      ? `Valid YAML structure (${yamlResult.lineCount} lines checked)`
                      : `${yamlResult.issues.length} syntax issue${
                          yamlResult.issues.length === 1 ? '' : 's'
                        } detected`}
                  </span>
                </div>

                {yamlResult.issues.length > 0 && (
                  <ul className="space-y-1.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    {yamlResult.issues.map((issue, idx) => (
                      <li key={idx} className="font-display-mono">
                        Line {issue.line}: {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 10. NETHER COORDINATE CALCULATOR */}
            {selectedTool === 'nether' && (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNetherFrom('overworld')}
                    className={`h-10 rounded-md border text-xs font-semibold ${
                      netherFrom === 'overworld'
                        ? 'border-rose-500 bg-rose-600 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                    }`}
                  >
                    Overworld → Nether (÷ 8)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetherFrom('nether')}
                    className={`h-10 rounded-md border text-xs font-semibold ${
                      netherFrom === 'nether'
                        ? 'border-rose-500 bg-rose-600 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                    }`}
                  >
                    Nether → Overworld (× 8)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="nether-x" className="block text-xs font-medium text-zinc-300">
                      X Coordinate
                    </label>
                    <input
                      id="nether-x"
                      type="number"
                      value={coordX}
                      onChange={(e) => setCoordX(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="nether-z" className="block text-xs font-medium text-zinc-300">
                      Z Coordinate
                    </label>
                    <input
                      id="nether-z"
                      type="number"
                      value={coordZ}
                      onChange={(e) => setCoordZ(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Destination Portal Coordinates ({netherFrom === 'overworld' ? 'Nether' : 'Overworld'})
                  </p>
                  <p className="mt-1.5 font-display-mono text-2xl font-bold text-white tabular-nums">
                    X: {netherConverted.x} &nbsp;·&nbsp; Z: {netherConverted.z}
                  </p>
                </div>
              </div>
            )}

            {/* 11. SHULKER & STACK CALCULATOR */}
            {selectedTool === 'shulker' && (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="shulker-total" className="block text-xs font-medium text-zinc-300">
                      Total Items Needed
                    </label>
                    <input
                      id="shulker-total"
                      type="number"
                      min={0}
                      value={itemCount}
                      onChange={(e) => setItemCount(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="shulker-stack" className="block text-xs font-medium text-zinc-300">
                      Stack Limit
                    </label>
                    <select
                      id="shulker-stack"
                      value={stackSize}
                      onChange={(e) => setStackSize(Number(e.target.value))}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
                    >
                      <option value={64}>64 (Standard blocks / items)</option>
                      <option value={16}>16 (Ender pearls / eggs / signs)</option>
                      <option value={1}>1 (Tools / armor / potions)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <p className="text-[11px] text-zinc-400">Shulker Boxes</p>
                    <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
                      {shulkerResult.shulkers}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <p className="text-[11px] text-zinc-400">Stacks</p>
                    <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
                      {shulkerResult.stacks}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <p className="text-[11px] text-zinc-400">Loose Items</p>
                    <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
                      {shulkerResult.remainder}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <p className="text-[11px] text-zinc-400">Double Chests</p>
                    <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
                      {shulkerResult.doubleChests}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 12. ECONOMY MARGIN CALCULATOR */}
            {selectedTool === 'economy' && (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div>
                    <label htmlFor="econ-buy" className="block text-xs font-medium text-zinc-300">
                      Buy Cost ($)
                    </label>
                    <input
                      id="econ-buy"
                      type="number"
                      min={0}
                      step="any"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="econ-sell" className="block text-xs font-medium text-zinc-300">
                      Sell Price ($)
                    </label>
                    <input
                      id="econ-sell"
                      type="number"
                      min={0}
                      step="any"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="econ-tax" className="block text-xs font-medium text-zinc-300">
                      Auction / Shop Tax (%)
                    </label>
                    <input
                      id="econ-tax"
                      type="number"
                      min={0}
                      max={99}
                      step="any"
                      value={taxPct}
                      onChange={(e) => setTaxPct(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <p className="text-[11px] text-zinc-400">Net Sell</p>
                    <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
                      ${economyResult.netSell.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <p className="text-[11px] text-zinc-400">Profit / Item</p>
                    <p
                      className={`mt-1 font-display-mono text-xl font-bold tabular-nums ${
                        economyResult.profitPerItem >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      ${economyResult.profitPerItem.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <p className="text-[11px] text-zinc-400">Profit / Stack</p>
                    <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
                      ${economyResult.profitPerStack.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                    <p className="text-[11px] text-zinc-400">Margin</p>
                    <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
                      {economyResult.marginPercent}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 13. XP LEVEL CALCULATOR */}
            {selectedTool === 'xp' && (
              <div className="mt-5 space-y-5">
                <div>
                  <label htmlFor="xp-level-input" className="block text-xs font-medium text-zinc-300">
                    Target Enchanting / Player Level
                  </label>
                  <input
                    id="xp-level-input"
                    type="number"
                    min={0}
                    max={500}
                    value={xpLevel}
                    onChange={(e) => setXpLevel(e.target.value)}
                    className="mt-1 h-10 w-full max-w-xs rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
                  />
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Total XP Required From Level 0
                  </p>
                  <p className="mt-1.5 font-display-mono text-2xl font-bold text-emerald-300 tabular-nums">
                    {xpTotal.toLocaleString()} XP points
                  </p>
                </div>
              </div>
            )}

            {/* 14-31: EXTENDED UTILITIES WORKBENCH */}
            <ToolsExtendedPanels
              toolId={selectedTool}
              onCopy={copyValue}
              copiedKey={copiedKey}
            />
          </div>
        </div>
      </div>
      )}
    </section>
  );
};
