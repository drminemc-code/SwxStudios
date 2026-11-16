import { CategoryMeta, CommunityThread, LevelTier, ResourceItem } from '../types';

export const CATEGORIES: CategoryMeta[] = [
  { id: 'plugins', label: 'Plugins', baseCount: 0, description: 'Core gameplay mechanics, anti-cheats, and server utilities' },
  { id: 'configs', label: 'Configs', baseCount: 0, description: 'Pre-tuned DeluxeMenus, TAB, Scoreboard, and Vulcan presets' },
  { id: 'setups', label: 'Server setups', baseCount: 0, description: 'Complete ready-to-launch Lifesteal, Earth, Skyblock & Duels cores' },
  { id: 'models', label: 'Models', baseCount: 0, description: 'Custom 3D Blockbench weapons, armors, and ItemsAdder packs' },
  { id: 'maps', label: 'Maps & builds', baseCount: 0, description: 'Spawns, lobbies, KOTH arenas, and custom terrain worlds' },
  { id: 'skripts', label: 'Skripts', baseCount: 0, description: 'Lightweight drop-in scripts for events, economy, and combat' },
  { id: 'clients', label: 'Clients', baseCount: 0, description: 'Performance-tuned FPS packs and custom HUD overlays' },
  { id: 'bots', label: 'Bots', baseCount: 0, description: 'Discord ticket, whitelist sync, and store webhook bots' },
  { id: 'source', label: 'Source code', baseCount: 0, description: 'Clean Java & Kotlin repositories for custom server forks' },
];

export const POPULAR_SEARCHES = [
  'lifesteal',
  'skyblock',
  'economy',
  'anticheat',
  'crates',
  'lobby',
  'smp',
  'boxpvp',
  'prison',
];

export const INITIAL_RESOURCES: ResourceItem[] = [];

export const INITIAL_THREADS: CommunityThread[] = [];

export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, name: 'Bronze Builder', minXp: 0, perks: 'Access to all free plugins, configs, and community threads' },
  { level: 2, name: 'Iron Configurator', minXp: 150, perks: 'Custom profile flair, thread upvoting priority & early changelog access' },
  { level: 3, name: 'Diamond Architect', minXp: 400, perks: 'Request priority in Community Requests & showcase spotlight eligibility' },
  { level: 4, name: 'Netherite Partner', minXp: 850, perks: 'Creator verification badge & 20% sponsorship slot discount' },
];
