import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResourceIdFromTitle,
  buildValidatedResourceRecord,
  extractArchiveExtension,
  formatFileSize,
  isOwnerAccount,
  OWNER_EMAIL,
  parseFeatureList,
  parseTagList,
  validateResourceDraft,
} from './adminLogic.ts';

describe('adminLogic', () => {
  it('enforces strict owner-only access check', () => {
    assert.equal(isOwnerAccount(OWNER_EMAIL, true), true);
    assert.equal(isOwnerAccount('RandelleMupas@gmail.com', true), true);
    assert.equal(isOwnerAccount('drminemc@gmail.com', true), true);
    assert.equal(isOwnerAccount('DrMineMC@gmail.com', true), true);
    assert.equal(isOwnerAccount(OWNER_EMAIL, false), false);
    assert.equal(isOwnerAccount('drminemc@gmail.com', false), false);
    assert.equal(isOwnerAccount('someoneelse@gmail.com', true), false);
    assert.equal(isOwnerAccount(null, true), false);
  });

  it('recognizes allowed plugin and archive extensions and rejects executables', () => {
    assert.equal(extractArchiveExtension('SwxCore.jar'), 'jar');
    assert.equal(extractArchiveExtension('LifestealSetup.zip'), 'zip');
    assert.equal(extractArchiveExtension('ModelsPack.rar'), 'rar');
    assert.equal(extractArchiveExtension('WorldBackup.7z'), '7z');
    assert.equal(extractArchiveExtension('ServerBundle.tar.gz'), 'gz');
    assert.equal(extractArchiveExtension('ConfigDump.gz'), 'gz');
    assert.equal(extractArchiveExtension('SourceArchive.tar'), 'tar');

    assert.equal(extractArchiveExtension('virus.exe'), null);
    assert.equal(extractArchiveExtension('script.sh'), null);
    assert.equal(extractArchiveExtension('noextension'), null);
  });

  it('formats byte sizes cleanly', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(512), '512 B');
    assert.equal(formatFileSize(1536), '1.5 KB');
    assert.equal(formatFileSize(2 * 1024 * 1024), '2.0 MB');
  });

  it('parses bounded tags and feature lists', () => {
    const tags = parseTagList('lifesteal, Lifesteal, smp, economy, 1,2,3,4,5,6,7,8,9');
    assert.equal(tags.length, 10);
    assert.equal(tags[0], 'lifesteal');

    const features = parseFeatureList('Async storage\n\nCustom GUIs\n1.21+ support');
    assert.deepEqual(features, ['Async storage', 'Custom GUIs', '1.21+ support']);
  });

  it('validates drafts and builds blueprint-compliant records', () => {
    const validDraft = {
      title: 'SwxCombat Pro',
      subtitle: 'Zero-lag combat tagging & pearl cooldown plugin',
      description: 'Full Paper/Folia combat logging system with customizable bossbars and WorldGuard hooks.',
      category: 'plugins' as const,
      version: 'v1.2.0',
      mcVersions: '1.20.4 - 1.21.4',
      fileSize: '1.4 MB',
      author: 'SwxStudios',
      popular: true,
      exclusive: false,
      tagsText: 'combat, pvp, paper',
      featuresText: 'Folia async safe\nConfigurable bossbar',
      artwork: 'lifesteal' as const,
      fileName: 'SwxCombat-1.2.0.jar',
      downloadUrl: '/api/files/1700-SwxCombat-1.2.0.jar/SwxCombat-1.2.0.jar',
    };

    assert.equal(validateResourceDraft(validDraft), null);
    assert.ok(validateResourceDraft({ ...validDraft, fileName: 'malware.exe' }));
    assert.ok(validateResourceDraft({ ...validDraft, title: 'X' }));

    const id = buildResourceIdFromTitle(validDraft.title, 12345);
    assert.equal(id, 'swxcombat-pro-12345');

    const record = buildValidatedResourceRecord({
      id,
      draft: validDraft,
      ownerUid: 'owner-uid-1',
    });
    assert.equal(record.fileExtension, 'jar');
    assert.equal(record.downloads, 0);
    assert.equal(record.createdBy, 'owner-uid-1');
    assert.equal(record.tier, 'free');

    const paidRecord = buildValidatedResourceRecord({
      id: 'paid-id',
      draft: { ...validDraft, tier: 'paid', priceLabel: '$9.99' },
      ownerUid: 'owner-uid-1',
    });
    assert.equal(paidRecord.tier, 'paid');
    assert.equal(paidRecord.priceLabel, '$9.99');
    assert.equal(paidRecord.exclusive, false);

    const ultimateRecord = buildValidatedResourceRecord({
      id: 'ult-id',
      draft: {
        ...validDraft,
        tier: 'ultimate',
        openSource: false,
        drmFree: true,
        unobfuscated: true,
        aiMarketing: false,
        aiProduct: false,
        gameModesText: 'Survival, BoxPVP, Practice',
        supportedSoftware: ['Paper', 'Purpur'],
        supportedVersionsText: '1.21, 1.20',
        supportedLanguagesText: 'English, Spanish',
        dependenciesText: 'Vault, PlaceholderAPI',
        changelogText: 'v1.2.0 | 2026-11-16 | Added Purpur async reset\nv1.1.0 | 2026-11-10 | Initial build',
      },
      ownerUid: 'owner-uid-1',
    });
    assert.equal(ultimateRecord.tier, 'ultimate');
    assert.equal(ultimateRecord.exclusive, true);
    assert.deepEqual(ultimateRecord.gameModes, ['Survival', 'BoxPVP', 'Practice']);
    assert.deepEqual(ultimateRecord.supportedSoftware, ['Paper', 'Purpur']);
    assert.deepEqual(ultimateRecord.supportedVersions, ['1.21', '1.20']);
    assert.deepEqual(ultimateRecord.supportedLanguages, ['English', 'Spanish']);
    assert.deepEqual(ultimateRecord.dependencies, ['Vault', 'PlaceholderAPI']);
    assert.equal(ultimateRecord.changelog?.length, 2);
    assert.equal(ultimateRecord.changelog?.[0].version, 'v1.2.0');
  });
});
