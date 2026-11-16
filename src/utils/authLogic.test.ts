import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInitials,
  isValidFirestoreId,
  mergeConnectedAccounts,
  resolveDisplayIdentity,
  validateSignInInput,
  validateSignUpInput,
} from './authLogic.ts';

describe('authLogic', () => {
  it('validates sign-up input against blueprint limits', () => {
    assert.equal(
      validateSignUpInput({
        displayName: 'SwxBuilder',
        email: 'builder@swxstudios.net',
        password: 'password123',
      }),
      null
    );

    assert.ok(
      validateSignUpInput({
        displayName: 'A',
        email: 'builder@swxstudios.net',
        password: 'password123',
      })
    );

    assert.ok(
      validateSignUpInput({
        displayName: 'SwxBuilder',
        email: 'not-an-email',
        password: 'password123',
      })
    );

    assert.ok(
      validateSignUpInput({
        displayName: 'SwxBuilder',
        email: 'builder@swxstudios.net',
        password: '123',
      })
    );
  });

  it('validates sign-in input', () => {
    assert.equal(
      validateSignInInput({ email: 'dev@swxstudios.net', password: 'secret' }),
      null
    );
    assert.ok(validateSignInInput({ email: 'bad', password: 'secret' }));
    assert.ok(validateSignInInput({ email: 'dev@swxstudios.net', password: '' }));
  });

  it('enforces safe Firestore ID regex', () => {
    assert.equal(isValidFirestoreId('discord'), true);
    assert.equal(isValidFirestoreId('user_123-abc'), true);
    assert.equal(isValidFirestoreId('discord/../../admin'), false);
    assert.equal(isValidFirestoreId(''), false);
  });

  it('merges Firebase providers and 3P OAuth connections cleanly', () => {
    const merged = mergeConnectedAccounts({
      firebaseProviders: [
        {
          providerId: 'google.com',
          uid: 'g-123',
          displayName: 'Alex Steve',
          email: 'alex@gmail.com',
          photoURL: 'https://example.com/a.png',
        },
      ],
      oauthConnections: {
        discord: {
          provider: 'discord',
          providerUserId: '998877',
          username: 'alex_mc',
          displayName: 'AlexMC',
          email: 'alex@gmail.com',
          avatarUrl: null,
          profileUrl: 'https://discord.com/users/998877',
          connectedAt: '2026-11-16T00:00:00.000Z',
          source: 'oauth',
        },
      },
      firestoreConnections: {},
    });

    assert.equal(merged.google?.username, 'alex');
    assert.equal(merged.discord?.username, 'alex_mc');
    assert.equal(merged.github, undefined);
  });

  it('resolves identity priority (Firebase primary, OAuth fallback, Guest default)', () => {
    const guest = resolveDisplayIdentity({ firebaseUser: null, primaryOAuth: null });
    assert.equal(guest.isSignedIn, false);
    assert.equal(guest.initials, 'SW');

    const discordOnly = resolveDisplayIdentity({
      firebaseUser: null,
      primaryOAuth: {
        provider: 'discord',
        providerUserId: '1122',
        username: 'craft_dev',
        displayName: 'Craft Dev',
        email: null,
        avatarUrl: null,
        profileUrl: null,
        connectedAt: '2026-11-16T00:00:00.000Z',
        source: 'oauth',
      },
    });
    assert.equal(discordOnly.isSignedIn, true);
    assert.equal(discordOnly.primaryProvider, 'discord');
    assert.equal(discordOnly.initials, 'CD');

    const firebasePrimary = resolveDisplayIdentity({
      firebaseUser: {
        uid: 'uid-1',
        displayName: 'Randelle',
        email: 'randelle@gmail.com',
        photoURL: null,
        emailVerified: true,
        providerData: [
          {
            providerId: 'google.com',
            uid: 'g-1',
            displayName: 'Randelle',
            email: 'randelle@gmail.com',
            photoURL: null,
          },
        ],
      },
      primaryOAuth: null,
    });
    assert.equal(firebasePrimary.isSignedIn, true);
    assert.equal(firebasePrimary.emailVerified, true);
    assert.equal(firebasePrimary.primaryProvider, 'google');
    assert.equal(computeInitials('Randelle'), 'RA');
  });
});
