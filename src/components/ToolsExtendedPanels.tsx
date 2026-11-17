import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FlaskConical,
  Map as MapIcon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  analyzeSparkReport,
  ArmorMaterial,
  buildMinecraftCommand,
  buildTabAnimationsYaml,
  calculateElytraFlight,
  calculateFarmingYield,
  calculateGearStats,
  calculateMobFarmYield,
  calculateTravelTimes,
  calculateVillagerTrade,
  convertFancyTextFont,
  ENCHANT_CATALOG,
  EnchantableGearType,
  evaluateEnchantments,
  FANCY_FONT_STYLES,
  inspectJarBytesForPatterns,
  isSlimeChunk,
  JarAuditResult,
  MC_COLOR_MAP,
  McCommandType,
  parseMaterialList,
  POTION_RECIPES,
  sampleBiomeAtChunk,
  seedToNumber,
} from '../utils/mcToolsLogic';
import { MinecraftFormattedText } from './MinecraftTextPreview';
import { MinecraftSkinViewer } from './MinecraftSkinViewer';

interface ExtendedPanelProps {
  toolId: string;
  onCopy: (key: string, value: string, label?: string) => void;
  copiedKey: string | null;
}

export const ToolsExtendedPanels: React.FC<ExtendedPanelProps> = ({
  toolId,
  onCopy,
  copiedKey,
}) => {
  // Color Generator
  const [colorSample, setColorSample] = useState('SwxStudios Network');
  const [pickedHex, setPickedHex] = useState('#e11d48');
  const [selectedCode, setSelectedCode] = useState('c');
  const [colorBold, setColorBold] = useState(true);

  const hexExpandedLegacy = useMemo(() => {
    const clean = pickedHex.replace('#', '').slice(0, 6);
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '';
    return `&x${clean.split('').map((c) => `&${c}`).join('')}`;
  }, [pickedHex]);

  // Command Builder
  const [cmdType, setCmdType] = useState<McCommandType>('give');
  const [cmdTarget, setCmdTarget] = useState('@p');
  const [cmdSubject, setCmdSubject] = useState('minecraft:diamond_sword');
  const [cmdAmt, setCmdAmt] = useState('1');
  const [cmdVal, setCmdVal] = useState('1');
  const [cmdCoords, setCmdCoords] = useState('~ ~ ~');
  const [cmdExtra, setCmdExtra] = useState('');

  const builtCommand = useMemo(
    () =>
      buildMinecraftCommand({
        commandType: cmdType,
        target: cmdTarget,
        itemOrEntity: cmdSubject,
        amountOrDuration: cmdAmt,
        amplifierOrValue: cmdVal,
        coords: cmdCoords,
        extraJson: cmdExtra,
      }),
    [cmdType, cmdTarget, cmdSubject, cmdAmt, cmdVal, cmdCoords, cmdExtra]
  );

  // Seed Map
  const [seedInput, setSeedInput] = useState('774921084');
  const [seedCenterX, setSeedCenterX] = useState('0');
  const [seedCenterZ, setSeedCenterZ] = useState('0');
  const [showSlimes, setShowSlimes] = useState(true);
  const seedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (toolId !== 'seedmap') return;
    const canvas = seedCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const seedBig = seedToNumber(seedInput || '0');
    const centerChunkX = Math.floor((Number(seedCenterX) || 0) / 16);
    const centerChunkZ = Math.floor((Number(seedCenterZ) || 0) / 16);
    const radius = 16; // 33x33 chunk window
    const cell = canvas.width / (radius * 2 + 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = centerChunkX + dx;
        const cz = centerChunkZ + dz;
        const biome = sampleBiomeAtChunk(seedBig, cx, cz);
        const px = (dx + radius) * cell;
        const py = (dz + radius) * cell;
        ctx.fillStyle = biome.color;
        ctx.fillRect(px, py, cell + 0.5, cell + 0.5);

        if (showSlimes && isSlimeChunk(seedBig, cx, cz)) {
          ctx.fillStyle = 'rgba(132, 204, 22, 0.72)';
          ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        }

        if (biome.isVillageCandidate) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px + cell / 2, py + cell / 2, Math.max(2, cell * 0.25), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Center crosshair
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    const mid = radius * cell + cell / 2;
    ctx.beginPath();
    ctx.moveTo(mid - 8, mid);
    ctx.lineTo(mid + 8, mid);
    ctx.moveTo(mid, mid - 8);
    ctx.lineTo(mid, mid + 8);
    ctx.stroke();
  }, [toolId, seedInput, seedCenterX, seedCenterZ, showSlimes]);

  // Malware Scanner
  const jarScanInputRef = useRef<HTMLInputElement | null>(null);
  const [jarAudit, setJarAudit] = useState<JarAuditResult | null>(null);

  const handleScanJarFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(reader.result);
        setJarAudit(inspectJarBytesForPatterns(bytes, file.name));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Material Calculator
  const [materialText, setMaterialText] = useState(
    'Stone Bricks: 2400\nOak Planks: 960\nGlass: 512\nSpruce Logs: 320'
  );
  const materialResult = useMemo(() => parseMaterialList(materialText), [materialText]);

  // Fancy Text Fonts Generator
  const [fontInput, setFontInput] = useState('SwxStudios Network 1.21');
  const [fontColorPrefix, setFontColorPrefix] = useState('&c&l');

  // Potion Guide
  const [potionFilter, setPotionFilter] = useState<'All' | 'Positive' | 'Negative' | 'Utility'>('All');
  const [potionForm, setPotionForm] = useState<'regular' | 'splash' | 'lingering'>('regular');
  const [potionSearch, setPotionSearch] = useState('');
  const filteredPotions = useMemo(
    () =>
      POTION_RECIPES.filter((p) => {
        if (potionFilter !== 'All' && p.category !== potionFilter) return false;
        const q = potionSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.ingredient.toLowerCase().includes(q) ||
          p.effect.toLowerCase().includes(q)
        );
      }),
    [potionFilter, potionSearch]
  );

  // Elytra & Travel
  const [elytraDist, setElytraDist] = useState('2500');
  const [rocketTier, setRocketTier] = useState<1 | 2 | 3>(1);
  const elytraResult = useMemo(
    () => calculateElytraFlight(Number(elytraDist) || 0, rocketTier),
    [elytraDist, rocketTier]
  );

  const [travelDist, setTravelDist] = useState('5000');
  const travelRows = useMemo(
    () => calculateTravelTimes(Number(travelDist) || 0),
    [travelDist]
  );

  // Villager Trading
  const [villagerBase, setVillagerBase] = useState('32');
  const [villagerCures, setVillagerCures] = useState('2');
  const [villagerHero, setVillagerHero] = useState('1');
  const [villagerQty, setVillagerQty] = useState('8');
  const villagerResult = useMemo(
    () =>
      calculateVillagerTrade(
        Number(villagerBase) || 1,
        Number(villagerCures) || 0,
        Number(villagerHero) || 0,
        Number(villagerQty) || 1
      ),
    [villagerBase, villagerCures, villagerHero, villagerQty]
  );

  // Enchantment Planner
  const [enchantItem, setEnchantItem] = useState<EnchantableGearType>('Pickaxe');
  const [selectedEnchants, setSelectedEnchants] = useState<string[]>([
    'efficiency',
    'unbreaking',
    'fortune',
    'mending',
  ]);
  const itemEnchants = useMemo(
    () => ENCHANT_CATALOG.filter((e) => e.items.includes(enchantItem)),
    [enchantItem]
  );
  const enchantEval = useMemo(
    () => evaluateEnchantments(enchantItem, selectedEnchants),
    [enchantItem, selectedEnchants]
  );

  // Storage Planner
  const [storageItems, setStorageItems] = useState('12000');
  const storageStats = useMemo(() => {
    const n = Math.max(0, Math.floor(Number(storageItems) || 0));
    return {
      shulkers: Math.ceil(n / (27 * 64)),
      barrels: Math.ceil(n / (27 * 64)),
      singleChests: Math.ceil(n / (27 * 64)),
      doubleChests: Math.ceil(n / (54 * 64)),
    };
  }, [storageItems]);

  // Gear Planner
  const [helmMat, setHelmMat] = useState<ArmorMaterial>('Netherite');
  const [chestMat, setChestMat] = useState<ArmorMaterial>('Netherite');
  const [legsMat, setLegsMat] = useState<ArmorMaterial>('Netherite');
  const [bootsMat, setBootsMat] = useState<ArmorMaterial>('Netherite');
  const [protLvl, setProtLvl] = useState(4);
  const gearResult = useMemo(
    () =>
      calculateGearStats({
        helmet: helmMat,
        chestplate: chestMat,
        leggings: legsMat,
        boots: bootsMat,
        protectionLevelPerPiece: protLvl,
      }),
    [helmMat, chestMat, legsMat, bootsMat, protLvl]
  );

  // Farming Calculator
  const [farmW, setFarmW] = useState('18');
  const [farmL, setFarmL] = useState('18');
  const [farmCrop, setFarmCrop] = useState<
    'Wheat' | 'Carrots' | 'Potatoes' | 'Beetroot' | 'Nether Wart'
  >('Wheat');
  const farmResult = useMemo(
    () => calculateFarmingYield(Number(farmW) || 1, Number(farmL) || 1, farmCrop),
    [farmW, farmL, farmCrop]
  );

  // Mob Farm Calculator
  const [mobKillsHr, setMobKillsHr] = useState('1800');
  const [mobDropRate, setMobDropRate] = useState('1');
  const [mobLooting, setMobLooting] = useState<0 | 1 | 2 | 3>(3);
  const [mobXp, setMobXp] = useState('5');
  const [mobHours, setMobHours] = useState('2');
  const mobResult = useMemo(
    () =>
      calculateMobFarmYield({
        killsPerHour: Number(mobKillsHr) || 0,
        baseDropPerKill: Number(mobDropRate) || 0,
        lootingLevel: mobLooting,
        xpPerKill: Number(mobXp) || 0,
        sessionHours: Number(mobHours) || 0,
      }),
    [mobKillsHr, mobDropRate, mobLooting, mobXp, mobHours]
  );

  // Spark Profiler Analyzer
  const [sparkText, setSparkText] = useState(
    'TPS: 17.8 (5s), 18.2 (1m)\nMSPT mean: 56.4ms\n88% memory used (7.0GB / 8.0GB)\nTop tick source: Hopper / TileEntity & Villager entity ticking'
  );
  const sparkResult = useMemo(() => analyzeSparkReport(sparkText), [sparkText]);

  // TAB Animation Maker
  const [tabName, setTabName] = useState('swx_header');
  const [tabInterval, setTabInterval] = useState('200');
  const [tabFrames, setTabFrames] = useState(
    '&c&lSWXSTUDIOS &7| &fSeason 4\n&f&lSWXSTUDIOS &7| &cSeason 4\n&e&lSWXSTUDIOS &7| &fplay.swxstudios.net'
  );
  const [tabFrameIndex, setTabFrameIndex] = useState(0);

  const tabFrameList = useMemo(
    () =>
      tabFrames
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter(Boolean),
    [tabFrames]
  );

  useEffect(() => {
    if (toolId !== 'tab' || tabFrameList.length <= 1) return;
    const ms = Math.max(100, Math.min(3000, Number(tabInterval) || 250));
    const timer = window.setInterval(() => {
      setTabFrameIndex((idx) => (idx + 1) % tabFrameList.length);
    }, ms);
    return () => window.clearInterval(timer);
  }, [toolId, tabInterval, tabFrameList.length]);

  const tabYaml = useMemo(
    () => buildTabAnimationsYaml(tabName, Number(tabInterval) || 200, tabFrames),
    [tabName, tabInterval, tabFrames]
  );

  if (toolId === 'colors') {
    const legacyCodeString = `&${selectedCode}${colorBold ? '&l' : ''}${colorSample}`;
    const hexCodeString = `&#${pickedHex.replace('#', '')}${colorBold ? '&l' : ''}${colorSample}`;
    return (
      <div className="mt-5 space-y-5">
        <div className="rounded-lg border border-zinc-800 bg-[#0b0b0e] p-5 text-center space-y-2">
          <div className="text-xl">
            <MinecraftFormattedText text={legacyCodeString} />
          </div>
          <div className="text-xl">
            <MinecraftFormattedText text={hexCodeString} />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(MC_COLOR_MAP).map(([code, info]) => (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedCode(code)}
              className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 font-display-mono text-xs ${
                selectedCode === code
                  ? 'border-rose-500 bg-rose-500/15 text-white'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-300'
              }`}
            >
              <span
                className="h-3 w-3 rounded-sm border border-white/20"
                style={{ backgroundColor: info.hex }}
              />
              <span>&amp;{code}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="color-sample-in" className="block text-xs font-medium text-zinc-300">
              Preview Text
            </label>
            <input
              id="color-sample-in"
              type="text"
              value={colorSample}
              onChange={(e) => setColorSample(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="color-hex-in" className="block text-xs font-medium text-zinc-300">
              Custom RGB HEX
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="color-hex-in"
                type="color"
                value={pickedHex}
                onChange={(e) => setPickedHex(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-zinc-800 bg-zinc-950 p-1"
              />
              <input
                type="text"
                value={pickedHex}
                onChange={(e) => setPickedHex(e.target.value)}
                className="h-10 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={colorBold}
                  onChange={(e) => setColorBold(e.target.checked)}
                  className="h-4 w-4 accent-rose-600"
                />
                <span>Bold</span>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { k: 'c-leg', label: 'Classic Code', val: legacyCodeString },
            { k: 'c-hex', label: 'Modern HEX', val: hexCodeString },
            { k: 'c-x', label: 'Bungee &x Format', val: `${hexExpandedLegacy}${colorBold ? '&l' : ''}${colorSample}` },
          ].map((row) => (
            <div
              key={row.k}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <span className="text-zinc-500">{row.label}: </span>
                <span className="font-display-mono text-zinc-200 break-all">{row.val}</span>
              </div>
              <button
                type="button"
                onClick={() => onCopy(row.k, row.val, `Copied ${row.label}`)}
                className="shrink-0 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/60"
              >
                {copiedKey === row.k ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (toolId === 'commands') {
    return (
      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(['give', 'summon', 'effect', 'title', 'tp', 'gamerule'] as McCommandType[]).map(
            (type) => (
              <button
                key={type}
                type="button"
                onClick={() => setCmdType(type)}
                className={`h-8 rounded-md border px-3 font-display-mono text-xs font-semibold ${
                  cmdType === type
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                }`}
              >
                /{type}
              </button>
            )
          )}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {cmdType !== 'gamerule' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300">Target Selector</label>
              <input
                type="text"
                value={cmdTarget}
                onChange={(e) => setCmdTarget(e.target.value)}
                placeholder="@p, @a, @s, or username"
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300">
              {cmdType === 'give'
                ? 'Item ID'
                : cmdType === 'summon'
                ? 'Entity ID'
                : cmdType === 'effect'
                ? 'Effect ID'
                : cmdType === 'title'
                ? 'Title Slot (title/subtitle/actionbar)'
                : cmdType === 'gamerule'
                ? 'GameRule Key'
                : 'Destination Mode'}
            </label>
            <input
              type="text"
              value={cmdSubject}
              onChange={(e) => setCmdSubject(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>

          {(cmdType === 'give' || cmdType === 'effect') && (
            <div>
              <label className="block text-xs font-medium text-zinc-300">
                {cmdType === 'give' ? 'Amount (1-64)' : 'Duration (seconds)'}
              </label>
              <input
                type="number"
                value={cmdAmt}
                onChange={(e) => setCmdAmt(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
            </div>
          )}

          {(cmdType === 'effect' || cmdType === 'gamerule') && (
            <div>
              <label className="block text-xs font-medium text-zinc-300">
                {cmdType === 'effect' ? 'Amplifier (0-255)' : 'Value (true/false/int)'}
              </label>
              <input
                type="text"
                value={cmdVal}
                onChange={(e) => setCmdVal(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
            </div>
          )}

          {(cmdType === 'summon' || cmdType === 'tp') && (
            <div>
              <label className="block text-xs font-medium text-zinc-300">Coordinates (X Y Z)</label>
              <input
                type="text"
                value={cmdCoords}
                onChange={(e) => setCmdCoords(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
            </div>
          )}

          {(cmdType === 'give' || cmdType === 'summon' || cmdType === 'title') && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300">
                {cmdType === 'title' ? 'Display Message' : 'Optional NBT / Components JSON'}
              </label>
              <input
                type="text"
                value={cmdExtra}
                onChange={(e) => setCmdExtra(e.target.value)}
                placeholder={
                  cmdType === 'title' ? 'Welcome to SwxStudios' : '[custom_name="SwxBlade"]'
                }
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display-mono text-[11px] text-zinc-400">Generated Command</span>
            <button
              type="button"
              onClick={() => onCopy('mc-cmd', builtCommand, 'Copied command')}
              className="inline-flex h-7 items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/60"
            >
              {copiedKey === 'mc-cmd' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copiedKey === 'mc-cmd' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="mt-2 font-display-mono text-xs text-rose-300 break-all">{builtCommand}</p>
        </div>
      </div>
    );
  }

  if (toolId === 'seedmap') {
    return (
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="seed-input" className="block text-xs font-medium text-zinc-300">
              World Seed (numeric or text)
            </label>
            <input
              id="seed-input"
              type="text"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="seed-x" className="block text-xs font-medium text-zinc-300">
              Center Block X
            </label>
            <input
              id="seed-x"
              type="number"
              value={seedCenterX}
              onChange={(e) => setSeedCenterX(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="seed-z" className="block text-xs font-medium text-zinc-300">
              Center Block Z
            </label>
            <input
              id="seed-z"
              type="number"
              value={seedCenterZ}
              onChange={(e) => setSeedCenterZ(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <label className="inline-flex cursor-pointer items-center gap-2 text-zinc-200">
            <input
              type="checkbox"
              checked={showSlimes}
              onChange={(e) => setShowSlimes(e.target.checked)}
              className="h-4 w-4 accent-rose-600"
            />
            <span>Overlay Exact Java Slime Chunks</span>
          </label>
          <span className="font-display-mono text-[11px]">
            Showing 33×33 chunk grid (528×528 blocks)
          </span>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <canvas
            ref={seedCanvasRef}
            width={330}
            height={330}
            className="h-[300px] w-[300px] shrink-0 rounded-lg border border-zinc-800 bg-zinc-950"
          />
          <div className="space-y-2 text-xs text-zinc-300">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <MapIcon className="h-4 w-4 text-rose-400" />
              <span>Map Legend</span>
            </p>
            <ul className="space-y-1.5 text-[11px] text-zinc-400">
              <li><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#84cc16] mr-2" />Slime Chunk (Java LCG exact match)</li>
              <li><span className="inline-block h-2.5 w-2.5 rounded-full bg-white mr-2" />Village Structure Candidate</li>
              <li><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#4d7c0f] mr-2" />Plains / Forest Biome</li>
              <li><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#d97706] mr-2" />Desert Biome</li>
              <li><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#1d4ed8] mr-2" />Ocean Biome</li>
              <li><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#cbd5e1] mr-2" />Snowy Taiga Biome</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'malware') {
    return (
      <div className="mt-5 space-y-5">
        <input
          ref={jarScanInputRef}
          type="file"
          accept=".jar,.zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleScanJarFile(f);
            e.target.value = '';
          }}
        />

        <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/70 p-6 sm:flex-row">
          <div>
            <p className="text-xs font-bold text-white">Local Plugin JAR / ZIP Bytecode Scanner</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Inspects uploaded JAR/ZIP bytecode strings locally for RCE (`Runtime.exec`, `ProcessBuilder`), Discord webhooks, remote classloaders, and `setOp` backdoors.
            </p>
          </div>
          <button
            type="button"
            onClick={() => jarScanInputRef.current?.click()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-500"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Scan Plugin File</span>
          </button>
        </div>

        {jarAudit && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {jarAudit.riskLevel === 'Clean' ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                )}
                <span className="font-bold text-white">{jarAudit.fileName}</span>
                <span className="font-display-mono text-zinc-500">
                  ({Math.round(jarAudit.byteSize / 1024)} KB · ~{jarAudit.classEntriesCount} classes)
                </span>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                  jarAudit.riskLevel === 'Clean'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : jarAudit.riskLevel === 'Review Recommended'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {jarAudit.riskLevel}
              </span>
            </div>

            {jarAudit.findings.length === 0 ? (
              <p className="text-zinc-400">
                No common backdoor, shell execution, or Discord webhook signatures matched.
              </p>
            ) : (
              <ul className="space-y-2">
                {jarAudit.findings.map((f) => (
                  <li
                    key={f.pattern}
                    className="rounded border border-zinc-800 bg-[#0b0b0e] p-2.5 flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="font-display-mono font-semibold text-rose-300">{f.pattern}</p>
                      <p className="text-[11px] text-zinc-400">{f.reason}</p>
                    </div>
                    <span className="font-display-mono shrink-0 text-[11px] text-zinc-300">
                      {f.matches}×
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  if (toolId === 'material') {
    return (
      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="mat-input" className="block text-xs font-medium text-zinc-300">
            Block List (one per line, e.g. Stone Bricks: 2400)
          </label>
          <textarea
            id="mat-input"
            rows={5}
            value={materialText}
            onChange={(e) => setMaterialText(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-zinc-100"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-zinc-400">Total Blocks</p>
            <p className="mt-1 font-display-mono text-lg font-bold text-white tabular-nums">
              {materialResult.totalItems.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-zinc-400">Shulker Boxes</p>
            <p className="mt-1 font-display-mono text-lg font-bold text-rose-300 tabular-nums">
              {materialResult.totalShulkers}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-zinc-400">Double Chests</p>
            <p className="mt-1 font-display-mono text-lg font-bold text-white tabular-nums">
              {materialResult.totalDoubleChests}
            </p>
          </div>
        </div>

        <div className="divide-y divide-zinc-800/80 rounded-lg border border-zinc-800 bg-zinc-950 text-xs">
          {materialResult.entries.map((entry, idx) => (
            <div key={idx} className="flex items-center justify-between px-3.5 py-2.5">
              <span className="font-medium text-zinc-200">{entry.name}</span>
              <span className="font-display-mono text-zinc-400 tabular-nums">
                {entry.shulkers > 0 ? `${entry.shulkers} sb · ` : ''}
                {entry.stacks} st · {entry.remainder} pcs
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (toolId === 'skin') {
    return <MinecraftSkinViewer />;
  }

  if (toolId === 'potion') {
    const formSuffix =
      potionForm === 'splash'
        ? ' + Gunpowder (Splash)'
        : potionForm === 'lingering'
        ? " + Gunpowder + Dragon's Breath (Lingering)"
        : '';

    return (
      <div className="mt-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['All', 'Positive', 'Utility', 'Negative'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setPotionFilter(cat)}
                className={`h-8 rounded border px-3 text-xs font-semibold ${
                  potionFilter === cat
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={potionSearch}
            onChange={(e) => setPotionSearch(e.target.value)}
            placeholder="Search ingredient or potion..."
            className="h-8 rounded border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-zinc-500">Bottle Modifier:</span>
          {(
            [
              { id: 'regular', label: 'Standard Bottle' },
              { id: 'splash', label: 'Splash (+Gunpowder)' },
              { id: 'lingering', label: "Lingering (+Dragon's Breath)" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPotionForm(f.id)}
              className={`h-7 rounded border px-2.5 text-[11px] font-semibold ${
                potionForm === f.id
                  ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {filteredPotions.map((p) => (
            <div key={p.name} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-white">
                  <FlaskConical className="h-3.5 w-3.5 text-rose-400" />
                  <span>
                    {potionForm === 'splash'
                      ? `Splash ${p.name}`
                      : potionForm === 'lingering'
                      ? `Lingering ${p.name}`
                      : p.name}
                  </span>
                </span>
                <span className="font-display-mono text-[10px] text-zinc-500">{p.category}</span>
              </div>
              <p className="mt-1 text-zinc-400">
                {p.base} + <strong className="text-zinc-200">{p.ingredient}</strong>
                {formSuffix && <span className="text-rose-300">{formSuffix}</span>}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Base: {p.baseDuration} · Redstone: {p.redstoneDuration} · Glowstone: {p.glowstoneTier}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (toolId === 'elytra') {
    return (
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="elytra-dist" className="block text-xs font-medium text-zinc-300">
              Trip Distance (blocks)
            </label>
            <input
              id="elytra-dist"
              type="number"
              min={0}
              value={elytraDist}
              onChange={(e) => setElytraDist(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="elytra-tier" className="block text-xs font-medium text-zinc-300">
              Firework Rocket Flight Duration
            </label>
            <select
              id="elytra-tier"
              value={rocketTier}
              onChange={(e) => setRocketTier(Number(e.target.value) as 1 | 2 | 3)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
            >
              <option value={1}>Duration 1 (1 Gunpowder)</option>
              <option value={2}>Duration 2 (2 Gunpowder)</option>
              <option value={3}>Duration 3 (3 Gunpowder)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Rockets Needed</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-rose-300 tabular-nums">
              {elytraResult.rocketsNeeded}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Flight Time</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
              {elytraResult.flightSeconds}s
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Cruise Speed</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
              {elytraResult.speedBlocksPerSec} b/s
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'traveltime') {
    return (
      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="travel-dist" className="block text-xs font-medium text-zinc-300">
            Journey Distance (Overworld blocks)
          </label>
          <input
            id="travel-dist"
            type="number"
            min={0}
            value={travelDist}
            onChange={(e) => setTravelDist(e.target.value)}
            className="mt-1 h-10 w-full max-w-xs rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
          />
        </div>
        <div className="divide-y divide-zinc-800/80 rounded-lg border border-zinc-800 bg-zinc-950 text-xs">
          {travelRows.map((row) => (
            <div key={row.mode} className="flex items-center justify-between px-4 py-2.5">
              <span className="font-medium text-zinc-200">{row.mode}</span>
              <span className="font-display-mono text-rose-300 tabular-nums">{row.formatted}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (toolId === 'villager') {
    return (
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300">Base Emeralds</label>
            <input
              type="number"
              min={1}
              max={64}
              value={villagerBase}
              onChange={(e) => setVillagerBase(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300">Zombie Cures (0-5)</label>
            <input
              type="number"
              min={0}
              max={5}
              value={villagerCures}
              onChange={(e) => setVillagerCures(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300">Hero Level (0-5)</label>
            <input
              type="number"
              min={0}
              max={5}
              value={villagerHero}
              onChange={(e) => setVillagerHero(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300">Trade Count</label>
            <input
              type="number"
              min={1}
              value={villagerQty}
              onChange={(e) => setVillagerQty(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Cost / Trade</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-emerald-300 tabular-nums">
              {villagerResult.pricePerTrade} em
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Total Cost</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
              {villagerResult.totalEmeralds} em
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Emeralds Saved</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-rose-300 tabular-nums">
              {villagerResult.totalSaved} em
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'enchant') {
    return (
      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(['Pickaxe', 'Sword', 'Axe', 'Bow', 'Helmet', 'Armor', 'Boots', 'Trident'] as EnchantableGearType[]).map(
            (g) => (
              <button
                key={g}
                type="button"
                onClick={() => setEnchantItem(g)}
                className={`h-8 rounded border px-3 text-xs font-semibold ${
                  enchantItem === g
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                }`}
              >
                {g}
              </button>
            )
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {itemEnchants.map((ench) => {
            const checked = selectedEnchants.includes(ench.id);
            return (
              <label
                key={ench.id}
                className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-xs ${
                  checked
                    ? 'border-rose-500/60 bg-rose-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                }`}
              >
                <span>{ench.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedEnchants((prev) =>
                      prev.includes(ench.id)
                        ? prev.filter((id) => id !== ench.id)
                        : [...prev, ench.id]
                    )
                  }
                  className="h-4 w-4 accent-rose-600"
                />
              </label>
            );
          })}
        </div>

        {enchantEval.conflicts.length > 0 && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200 space-y-1">
            {enchantEval.conflicts.map((c) => (
              <p key={c} className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{c}</span>
              </p>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 text-xs">
          <span className="text-zinc-400">Estimated Anvil XP Levels: </span>
          <strong className="font-display-mono text-base text-white">
            {enchantEval.estimatedAnvilLevels} levels
          </strong>
        </div>
      </div>
    );
  }

  if (toolId === 'storage') {
    return (
      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="store-items" className="block text-xs font-medium text-zinc-300">
            Total Stackable Items (64/stack)
          </label>
          <input
            id="store-items"
            type="number"
            min={0}
            value={storageItems}
            onChange={(e) => setStorageItems(e.target.value)}
            className="mt-1 h-10 w-full max-w-xs rounded-md border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Double Chests (54 slots)</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-rose-300 tabular-nums">
              {storageStats.doubleChests}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Single Chests (27 slots)</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
              {storageStats.singleChests}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Barrels (27 slots)</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
              {storageStats.barrels}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Shulker Boxes (27 slots)</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white tabular-nums">
              {storageStats.shulkers}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'gear') {
    const mats: ArmorMaterial[] = ['None', 'Leather', 'Chainmail', 'Iron', 'Gold', 'Diamond', 'Netherite'];
    return (
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
          {(
            [
              { label: 'Helmet', val: helmMat, set: setHelmMat },
              { label: 'Chestplate', val: chestMat, set: setChestMat },
              { label: 'Leggings', val: legsMat, set: setLegsMat },
              { label: 'Boots', val: bootsMat, set: setBootsMat },
            ] as const
          ).map((slot) => (
            <div key={slot.label}>
              <label className="block font-medium text-zinc-300">{slot.label}</label>
              <select
                value={slot.val}
                onChange={(e) => slot.set(e.target.value as ArmorMaterial)}
                className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-2 text-zinc-100"
              >
                {mats.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label className="block font-medium text-zinc-300">Protection (0-4)</label>
            <input
              type="number"
              min={0}
              max={4}
              value={protLvl}
              onChange={(e) => setProtLvl(Number(e.target.value) || 0)}
              className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-zinc-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Armor Points</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white">{gearResult.armorPoints} / 20</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Toughness</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white">{gearResult.toughness}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">KB Resistance</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white">{gearResult.knockbackResistancePct}%</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Damage Reduction</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-rose-300">{gearResult.damageReductionPct}%</p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'farming') {
    return (
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 text-xs">
          <div>
            <label className="block font-medium text-zinc-300">Plot Width (blocks)</label>
            <input
              type="number"
              min={1}
              value={farmW}
              onChange={(e) => setFarmW(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-zinc-100"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-300">Plot Length (blocks)</label>
            <input
              type="number"
              min={1}
              value={farmL}
              onChange={(e) => setFarmL(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-zinc-100"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-300">Crop Type</label>
            <select
              value={farmCrop}
              onChange={(e) =>
                setFarmCrop(e.target.value as typeof farmCrop)
              }
              className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
            >
              {['Wheat', 'Carrots', 'Potatoes', 'Beetroot', 'Nether Wart'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Water Sources Needed</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-sky-300">{farmResult.waterBlocksNeeded}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Farmland / Soul Sand</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white">{farmResult.farmlandBlocks}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Expected Harvest</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-emerald-300">{farmResult.expectedHarvest}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Est. Bone Meal</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white">{farmResult.boneMealForFullGrowth}</p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'mobfarm') {
    return (
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
          <div>
            <label className="block font-medium text-zinc-300">Kills / Hour</label>
            <input type="number" value={mobKillsHr} onChange={(e) => setMobKillsHr(e.target.value)} className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-zinc-100" />
          </div>
          <div>
            <label className="block font-medium text-zinc-300">Base Drop / Kill</label>
            <input type="number" step="0.1" value={mobDropRate} onChange={(e) => setMobDropRate(e.target.value)} className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-zinc-100" />
          </div>
          <div>
            <label className="block font-medium text-zinc-300">Looting (0-3)</label>
            <select value={mobLooting} onChange={(e) => setMobLooting(Number(e.target.value) as 0 | 1 | 2 | 3)} className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-2 text-zinc-100">
              <option value={0}>None</option>
              <option value={1}>Looting I</option>
              <option value={2}>Looting II</option>
              <option value={3}>Looting III</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-zinc-300">XP / Kill</label>
            <input type="number" value={mobXp} onChange={(e) => setMobXp(e.target.value)} className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-zinc-100" />
          </div>
          <div>
            <label className="block font-medium text-zinc-300">AFK Hours</label>
            <input type="number" step="0.5" value={mobHours} onChange={(e) => setMobHours(e.target.value)} className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-zinc-100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Drops / Hour</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white">{mobResult.itemsPerHour.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Session Total</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-rose-300">{mobResult.totalItems.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Shulkers Needed</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-white">{mobResult.shulkersNeeded}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Total XP Earned</p>
            <p className="mt-1 font-display-mono text-xl font-bold text-emerald-300">{mobResult.totalXp.toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'spark') {
    return (
      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-zinc-500">Diagnostic Presets:</span>
          {[
            {
              label: 'Hopper / Entity Lag',
              sample:
                'TPS: 17.8 (5s), 18.2 (1m)\nMSPT mean: 56.4ms\n88% memory used (7.0GB / 8.0GB)\nTop tick source: Hopper / TileEntity & Villager entity ticking',
            },
            {
              label: 'Healthy 20 TPS Paper',
              sample:
                'TPS: 20.0 (5s), 20.0 (1m)\nMSPT mean: 11.4ms\n42% memory used (3.4GB / 8.0GB)\nNo heavy tile entities detected',
            },
            {
              label: 'Memory / GC Spike',
              sample:
                'TPS: 15.1 (5s), 16.0 (1m)\nMSPT mean: 78.2ms\n96% memory used (11.5GB / 12.0GB)\nG1GC Old Gen pauses exceeding 350ms',
            },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSparkText(preset.sample)}
              className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-medium text-zinc-300 hover:border-rose-500/60 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <textarea
          rows={5}
          value={sparkText}
          onChange={(e) => setSparkText(e.target.value)}
          placeholder="Paste /spark health, TPS, MSPT, memory usage, or heavy tick lines..."
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-zinc-100"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Health</p>
            <p
              className={`mt-1 font-display-mono text-base font-bold ${
                sparkResult.severity === 'Healthy'
                  ? 'text-emerald-300'
                  : sparkResult.severity === 'Warning'
                  ? 'text-amber-300'
                  : 'text-rose-400'
              }`}
            >
              {sparkResult.severity}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Parsed TPS</p>
            <p className="mt-1 font-display-mono text-base font-bold text-white">
              {sparkResult.tpsOneMin ?? 'N/A'}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Parsed MSPT</p>
            <p className="mt-1 font-display-mono text-base font-bold text-white">
              {sparkResult.msptMean !== null ? `${sparkResult.msptMean}ms` : 'N/A'}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
            <p className="text-zinc-400">Heap Used</p>
            <p className="mt-1 font-display-mono text-base font-bold text-white">
              {sparkResult.memoryUsedPct !== null ? `${sparkResult.memoryUsedPct}%` : 'N/A'}
            </p>
          </div>
        </div>

        <ul className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">
          {sparkResult.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (toolId === 'tab') {
    const activeFrame = tabFrameList[tabFrameIndex % Math.max(1, tabFrameList.length)] || '';
    return (
      <div className="mt-5 space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-[#0b0b0e] p-5 text-center">
          <p className="font-display-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Live TAB Header Preview ({tabInterval}ms interval)
          </p>
          <div className="mt-2 font-display-mono text-lg">
            <MinecraftFormattedText text={activeFrame} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-300">Animation Key</label>
            <input
              type="text"
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300">Change Interval (ms)</label>
            <input
              type="number"
              min={50}
              step={50}
              value={tabInterval}
              onChange={(e) => setTabInterval(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-zinc-800 bg-zinc-950 px-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-300">
              Animation Frames (one line per frame)
            </label>
            <textarea
              rows={4}
              value={tabFrames}
              onChange={(e) => setTabFrames(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-3 font-display-mono text-xs text-zinc-100"
            />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display-mono text-[11px] text-zinc-400">animations.yml</span>
            <button
              type="button"
              onClick={() => onCopy('tab-yaml', tabYaml, 'Copied animations.yml')}
              className="inline-flex h-7 items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/60"
            >
              {copiedKey === 'tab-yaml' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copiedKey === 'tab-yaml' ? 'Copied' : 'Copy YAML'}</span>
            </button>
          </div>
          <pre className="mt-2 font-display-mono text-xs text-zinc-200 whitespace-pre-wrap">
            {tabYaml}
          </pre>
        </div>
      </div>
    );
  }

  if (toolId === 'fonts') {
    const cleanInput = fontInput || 'SwxStudios';
    return (
      <div className="mt-5 space-y-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label htmlFor="fancy-font-input" className="block text-xs font-medium text-zinc-300">
              Text to Stylize (&amp; and &#rrggbb codes preserved)
            </label>
            <input
              id="fancy-font-input"
              type="text"
              value={fontInput}
              onChange={(e) => setFontInput(e.target.value)}
              placeholder="Type your server name, rank, or scoreboard header..."
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-6">
            <span className="block text-xs font-medium text-zinc-300">
              Optional Color Prefix
            </span>
            <div className="mt-1 grid grid-cols-3 gap-1.5 sm:flex sm:h-10 sm:items-center">
              {[
                { label: 'None', code: '' },
                { label: 'Crimson', code: '&#e11d48&l' },
                { label: 'Red', code: '&c&l' },
                { label: 'Aqua', code: '&b&l' },
                { label: 'Gold', code: '&6&l' },
                { label: 'Green', code: '&a&l' },
              ].map((pref) => (
                <button
                  key={pref.label}
                  type="button"
                  onClick={() => setFontColorPrefix(pref.code)}
                  className={`h-8 flex-1 rounded border px-2 text-[11px] font-semibold whitespace-nowrap ${
                    fontColorPrefix === pref.code
                      ? 'border-rose-500 bg-rose-600 text-white'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  {pref.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {FANCY_FONT_STYLES.map((styleMeta) => {
            const styledText = convertFancyTextFont(cleanInput, styleMeta.id);
            const finalCopy = fontColorPrefix ? `${fontColorPrefix}${styledText}` : styledText;
            const copyKey = `font-${styleMeta.id}`;
            return (
              <div
                key={styleMeta.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-semibold text-zinc-300">{styleMeta.label}</span>
                    <span>·</span>
                    <span className="truncate">{styleMeta.sample}</span>
                  </div>
                  <div className="mt-1 truncate text-base text-white">
                    <MinecraftFormattedText text={finalCopy} />
                  </div>
                  {fontColorPrefix && (
                    <p className="mt-0.5 truncate font-display-mono text-[10px] text-zinc-500">
                      {finalCopy}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onCopy(copyKey, finalCopy, `Copied ${styleMeta.label} text`)
                  }
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/60"
                >
                  {copiedKey === copyKey ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === copyKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
