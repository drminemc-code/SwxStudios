import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSparkReport,
  buildLuckPermsCommand,
  buildMinecraftCommand,
  buildServerRecord,
  buildTabAnimationsYaml,
  calculateEconomyMargin,
  calculateElytraFlight,
  calculateFarmingYield,
  calculateGearStats,
  calculateMobFarmYield,
  calculateShulkersAndStacks,
  calculateTravelTimes,
  calculateVillagerTrade,
  classifyPingHealth,
  classifyTpsHealth,
  convertFancyTextFont,
  convertOverworldNether,
  convertTextFormat,
  evaluateEnchantments,
  filterActiveServerListings,
  generateHexGradient,
  inspectJarBytesForPatterns,
  isSlimeChunk,
  parseMaterialList,
  parseMinecraftFormattedSegments,
  parseTopPlayerEntry,
  parseTopPlayersText,
  resolveProbeRegionInfo,
  seedToNumber,
  sortServerListings,
  toServerPropertiesMotd,
  validateJsonText,
  validateServerDraft,
  validateYamlBasic,
  xpPointsForLevel,
} from './mcToolsLogic';

test('mcToolsLogic parses ampersand, section, and hex color codes', () => {
  const segs = parseMinecraftFormattedSegments('&a&lSwxStudios &7| &#ff5500Custom');
  assert.equal(segs.length, 3);
  assert.equal(segs[0].text, 'SwxStudios ');
  assert.equal(segs[0].color, '#55ff55');
  assert.equal(segs[0].bold, true);
  assert.equal(segs[1].color, '#aaaaaa');
  assert.equal(segs[1].bold, false);
  assert.equal(segs[2].color, '#ff5500');
  assert.equal(segs[2].text, 'Custom');
});

test('mcToolsLogic converts between ampersand, section, minimessage, and JSON', () => {
  assert.equal(convertTextFormat('&aHello &lWorld', 'section'), '§aHello §lWorld');
  assert.equal(convertTextFormat('§cAlert', 'ampersand'), '&cAlert');
  assert.equal(convertTextFormat('&a&lGo', 'minimessage'), '<green><bold>Go');
  const json = JSON.parse(convertTextFormat('&eNotice', 'json'));
  assert.equal(json.text, 'Notice');
  assert.equal(json.color, 'yellow');
});

test('mcToolsLogic builds gradients and server.properties MOTD', () => {
  const grad = generateHexGradient('SWX', '#ff0000', '#0000ff', 'minimessage', true);
  assert.equal(grad.output, '<gradient:#ff0000:#0000ff><bold>SWX</bold></gradient>');
  const prop = toServerPropertiesMotd('&aLine 1', '&7Line 2');
  assert.equal(prop, 'motd=\\u00A7aLine 1\\n\\u00A77Line 2');
});

test('mcToolsLogic builds LuckPerms and Minecraft commands accurately', () => {
  assert.equal(
    buildLuckPermsCommand({
      targetType: 'group',
      targetName: 'vip',
      node: 'swx.fly',
      value: 'true',
      server: 'survival',
      duration: '30d',
    }),
    '/lp group vip permission settemp swx.fly true 30d server=survival'
  );
  assert.equal(
    buildMinecraftCommand({
      commandType: 'effect',
      target: '@a',
      itemOrEntity: 'minecraft:speed',
      amountOrDuration: '60',
      amplifierOrValue: '2',
      coords: '~ ~ ~',
      extraJson: '',
    }),
    '/effect give @a minecraft:speed 60 2'
  );
});

test('mcToolsLogic validates JSON and basic YAML syntax', () => {
  assert.equal(validateJsonText('{"ok": true}').valid, true);
  assert.equal(validateJsonText('{bad}').valid, false);
  assert.equal(validateYamlBasic('server:\n  port: 25565\n  motd: "Hi"').valid, true);
  assert.equal(validateYamlBasic('server:\n\tport: 25565').valid, false);
  assert.equal(validateYamlBasic('port: 1\nport: 2').valid, false);
});

test('mcToolsLogic computes Nether, Shulker, XP, Economy, Material, Elytra, and Travel math', () => {
  assert.deepEqual(convertOverworldNether(800, -160, 'overworld'), { x: 100, z: -20 });
  assert.deepEqual(convertOverworldNether(10, 20, 'nether'), { x: 80, z: 160 });
  assert.deepEqual(calculateShulkersAndStacks(1792, 64), {
    total: 1792,
    doubleChests: 0.52,
    shulkers: 1,
    stacks: 1,
    remainder: 0,
  });
  assert.equal(xpPointsForLevel(30), 1395);
  assert.deepEqual(calculateEconomyMargin(10, 15, 10), {
    netSell: 13.5,
    profitPerItem: 3.5,
    profitPerStack: 224,
    marginPercent: 35,
  });

  const mat = parseMaterialList('Stone Bricks: 1728\n64 Oak Planks');
  assert.equal(mat.totalItems, 1792);
  assert.equal(mat.entries[0].shulkers, 1);

  const elytra = calculateElytraFlight(3350, 2);
  assert.equal(elytra.flightSeconds, 100);
  assert.ok(elytra.rocketsNeeded > 0);

  const travel = calculateTravelTimes(1000);
  assert.equal(travel.length, 8);
});

test('mcToolsLogic evaluates Villager, Enchantments, Gear, Farming, MobFarm, Spark, TAB, Malware, and Seed Map', () => {
  const trade = calculateVillagerTrade(32, 2, 1, 4);
  assert.equal(trade.pricePerTrade, 15);
  assert.equal(trade.totalEmeralds, 60);

  const conflictTest = evaluateEnchantments('Pickaxe', ['fortune', 'silk_touch', 'mending']);
  assert.equal(conflictTest.conflicts.length, 1);

  const gear = calculateGearStats({
    helmet: 'Netherite',
    chestplate: 'Netherite',
    leggings: 'Netherite',
    boots: 'Netherite',
    protectionLevelPerPiece: 4,
  });
  assert.equal(gear.armorPoints, 20);
  assert.equal(gear.toughness, 12);
  assert.equal(gear.knockbackResistancePct, 40);
  assert.ok(gear.damageReductionPct > 85);

  const farm = calculateFarmingYield(9, 9, 'Wheat');
  assert.equal(farm.waterBlocksNeeded, 1);
  assert.equal(farm.farmlandBlocks, 80);

  const mobFarm = calculateMobFarmYield({
    killsPerHour: 1000,
    baseDropPerKill: 1,
    lootingLevel: 2,
    xpPerKill: 5,
    sessionHours: 2,
  });
  assert.equal(mobFarm.itemsPerHour, 2000);
  assert.equal(mobFarm.totalXp, 10000);

  const spark = analyzeSparkReport('TPS 16.5 | MSPT 62.4 | 90% memory | hopper tick');
  assert.equal(spark.severity, 'Critical');
  assert.ok(spark.recommendations.length >= 3);

  const yaml = buildTabAnimationsYaml('header', 200, '&aLine 1\n&bLine 2');
  assert.ok(yaml.includes('change-interval: 200'));

  const payloadBytes = new TextEncoder().encode('PK\x03\x04Test.class Runtime.getRuntime().exec');
  const audit = inspectJarBytesForPatterns(payloadBytes, 'Suspicious.jar');
  assert.equal(audit.isZipContainer, true);
  assert.equal(audit.riskLevel, 'High Risk');

  const numericSeed = seedToNumber('SwxStudios');
  assert.equal(typeof numericSeed, 'bigint');
  const slimeBool = isSlimeChunk(123456n, 4, -7);
  assert.equal(typeof slimeBool, 'boolean');
});

test('mcToolsLogic validates and builds ServerListing payloads with TPS, MSPT, Ping, and Top Players', () => {
  const err = validateServerDraft({
    name: 'A',
    address: 'bad host',
    edition: 'Java',
    version: '1.21.4',
    motd: 'Hi',
    gameModesText: 'SMP',
  });
  assert.ok(err);

  const badTps = validateServerDraft({
    name: 'SwxNetwork',
    address: 'play.swxstudios.net',
    edition: 'Java',
    version: '1.21.4',
    motd: 'Hi',
    gameModesText: 'SMP',
    tpsText: '99',
  });
  assert.ok(badTps);

  const memberRecord = buildServerRecord({
    id: 'srv-1',
    draft: {
      name: 'SwxNetwork',
      address: 'play.swxstudios.net',
      edition: 'Crossplay',
      version: '1.21.4',
      motd: '&aSwxNetwork &7| &fSurvival',
      gameModesText: 'Survival, BoxPVP',
      description: 'Survival SMP with custom enchants.',
      bedrockAddress: 'bedrock.swxstudios.net:19132',
      tpsText: '19.95',
      msptText: '14.2',
      pingMsText: '28',
      topPlayersText: 'Notch | 140h Playtime\nSteve | $2.4M Balance',
    },
    submittedBy: 'uid-1',
    submittedByName: 'Player1',
    isOwner: false,
  });
  assert.equal(memberRecord.approved, false);
  assert.deepEqual(memberRecord.gameModes, ['Survival', 'BoxPVP']);
  assert.equal(memberRecord.tps, 19.95);
  assert.equal(memberRecord.mspt, 14.2);
  assert.equal(memberRecord.pingMs, 28);
  assert.deepEqual(memberRecord.topPlayers, [
    'Notch | 140h Playtime',
    'Steve | $2.4M Balance',
  ]);

  assert.deepEqual(parseTopPlayersText('A | 10, B | 20'), ['A | 10', 'B | 20']);
  assert.deepEqual(parseTopPlayerEntry('Notch | 140h Playtime'), {
    name: 'Notch',
    stat: '140h Playtime',
  });
  assert.equal(classifyPingHealth(28).tone, 'good');
  assert.equal(classifyTpsHealth(19.9).tone, 'good');
  assert.equal(classifyTpsHealth(15.2).tone, 'bad');
});

test('mcToolsLogic converts fancy Unicode text fonts while preserving Minecraft color tokens', () => {
  const smallCaps = convertFancyTextFont('&c&lSwxStudios 1.21', 'small-caps');
  assert.ok(smallCaps.startsWith('&c&l'));
  assert.ok(smallCaps.includes('ꜱᴡxꜱᴛᴜᴅɪᴏꜱ'));
  assert.ok(smallCaps.endsWith('1.21'));

  const hexPreserved = convertFancyTextFont('&#e11d48Arena', 'fullwidth');
  assert.equal(hexPreserved, '&#e11d48Ａｒｅｎａ');

  assert.equal(convertFancyTextFont('A0', 'circled'), 'Ⓐ⓪');
  assert.notEqual(convertFancyTextFont('Hypixel', 'gothic'), 'Hypixel');
});

test('mcToolsLogic defaults probe region to Asia (Singapore) and filters retired servers', () => {
  assert.deepEqual(resolveProbeRegionInfo(undefined), {
    id: 'asia',
    label: 'Asia (Singapore)',
    shortLabel: 'Asia · SG',
  });
  assert.deepEqual(resolveProbeRegionInfo('global'), {
    id: 'global',
    label: 'Global Anycast',
    shortLabel: 'Global',
  });
  assert.deepEqual(resolveProbeRegionInfo('unknown'), {
    id: 'asia',
    label: 'Asia (Singapore)',
    shortLabel: 'Asia · SG',
  });

  const filtered = filterActiveServerListings([
    { id: 'live-hazzardsmp', address: 'hazzardsmp.ultramc.co' },
    { id: 'custom-1', address: 'ecoverseprac.cc.cd:43845' },
    { id: 'custom-2', address: 'syvoxsmp.playwithbao.com' },
    { id: 'live-donutsmp', address: 'donutsmp.net' },
    { id: 'live-mcpvp', address: 'mcpvp.club' },
    { id: 'live-acersmp', address: 'acersmp.xyz' },
  ]);
  assert.deepEqual(
    filtered.map((s) => s.address),
    ['donutsmp.net', 'mcpvp.club', 'acersmp.xyz']
  );
});

test('mcToolsLogic sorts server listings by Most Voted, Highest TPS, and Lowest Ping', () => {
  const baseServers = [
    {
      id: 'srv-a',
      name: 'AlphaSMP',
      address: 'alpha.example.net',
      edition: 'Java' as const,
      version: '1.21.4',
      motd: 'Alpha',
      gameModes: ['Survival'],
      approved: true,
      featured: false,
      votes: 45,
      tps: 18.2,
      pingMs: 95,
      submittedBy: 'u1',
      submittedByName: 'Alice',
    },
    {
      id: 'srv-b',
      name: 'BetaPvP',
      address: 'beta.example.net',
      edition: 'Java' as const,
      version: '1.21.4',
      motd: 'Beta',
      gameModes: ['Crystal PvP'],
      approved: true,
      featured: true,
      votes: 220,
      tps: 19.6,
      pingMs: 42,
      submittedBy: 'u2',
      submittedByName: 'Bob',
    },
    {
      id: 'srv-c',
      name: 'GammaRealms',
      address: 'gamma.example.net',
      edition: 'Java' as const,
      version: '1.21.4',
      motd: 'Gamma',
      gameModes: ['Skyblock'],
      approved: true,
      featured: false,
      votes: 120,
      submittedBy: 'u3',
      submittedByName: 'Charlie',
    },
  ];

  const liveMap = {
    'srv-a': { loading: false, online: true, pingMs: 18, playersOnline: 30, playersMax: 100 },
    'srv-b': { loading: false, online: true, pingMs: 55, playersOnline: 80, playersMax: 200 },
  };
  const telemetryMap = {
    'gamma.example.net': {
      serverKey: 'gamma.example.net',
      address: 'gamma.example.net',
      tps: 20.0,
      mspt: 9.4,
      avgPingMs: 31,
      playersOnline: 10,
      playersMax: 50,
      topPlayers: [],
      source: 'spark',
      updatedAt: 'now',
    },
  };

  assert.deepEqual(
    sortServerListings(baseServers, 'votes', liveMap, telemetryMap).map((s) => s.id),
    ['srv-b', 'srv-c', 'srv-a']
  );

  assert.deepEqual(
    sortServerListings(baseServers, 'tps', liveMap, telemetryMap).map((s) => s.id),
    ['srv-c', 'srv-b', 'srv-a']
  );

  // Live pingMs (18ms on srv-a) takes precedence over fallback srv.pingMs (95ms),
  // telemetry avgPingMs (31ms on srv-c) ranks second, live 55ms on srv-b ranks third.
  assert.deepEqual(
    sortServerListings(baseServers, 'ping', liveMap, telemetryMap).map((s) => s.id),
    ['srv-a', 'srv-c', 'srv-b']
  );
});
