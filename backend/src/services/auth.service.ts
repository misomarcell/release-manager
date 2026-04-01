import crypto from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { config } from '../config.js';
import {
  findUserByUsername,
  createUser,
  getCredentialsByUserId,
  getCredentialById,
  createCredential,
  updateCredentialCounter,
  saveChallenge,
  consumeChallenge,
  createSession,
  getSession,
  deleteSession,
  findUserById,
} from '../repositories/user.repository.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function startRegistration(username: string) {
  let user = await findUserByUsername(username);
  if (!user) {
    user = await createUser(username);
  }

  const existingCreds = await getCredentialsByUserId(user.id);

  const options = await generateRegistrationOptions({
    rpName: config.rp.name,
    rpID: config.rp.id,
    userName: username,
    attestationType: 'none',
    excludeCredentials: existingCreds.map((c) => ({
      id: c.id,
      transports: c.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await saveChallenge(options.challenge, username);
  return options;
}

export async function finishRegistration(username: string, response: RegistrationResponseJSON) {
  const user = await findUserByUsername(username);
  if (!user) throw new Error('User not found');

  const valid = await consumeChallenge(
    response.response.clientDataJSON
      ? extractChallengeFromClientData(response.response.clientDataJSON)
      : '',
  );

  // Fallback: verify even if challenge consumption had issues
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: async (challenge) => {
      if (valid) return true;
      return await consumeChallenge(challenge);
    },
    expectedOrigin: config.rp.origin,
    expectedRPID: config.rp.id,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const { credential } = verification.registrationInfo;
  await createCredential(
    credential.id,
    user.id,
    Buffer.from(credential.publicKey),
    credential.counter,
    (credential.transports ?? []) as string[],
  );

  return { verified: true };
}

export async function startAuthentication() {
  const options = await generateAuthenticationOptions({
    rpID: config.rp.id,
    userVerification: 'preferred',
  });

  await saveChallenge(options.challenge);
  return options;
}

export async function finishAuthentication(response: AuthenticationResponseJSON) {
  const credId = response.id;
  const cred = await getCredentialById(credId);
  if (!cred) throw new Error('Credential not found');

  const user = await findUserById(cred.user_id);
  if (!user) throw new Error('User not found');
  if (!user.valid) throw new Error('Account not activated. Set valid=true in the database.');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: async (challenge) => {
      return await consumeChallenge(challenge);
    },
    expectedOrigin: config.rp.origin,
    expectedRPID: config.rp.id,
    credential: {
      id: cred.id,
      publicKey: new Uint8Array(cred.public_key),
      counter: cred.counter,
      transports: cred.transports as AuthenticatorTransport[],
    },
  });

  if (!verification.verified) throw new Error('Authentication verification failed');

  await updateCredentialCounter(credId, verification.authenticationInfo.newCounter);

  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await createSession(token, user.id, expiresAt);

  return { token, expiresAt, username: user.username };
}

export async function validateSession(token: string) {
  const session = await getSession(token);
  if (!session) return null;

  const user = await findUserById(session.user_id);
  if (!user || !user.valid) return null;

  return { userId: user.id, username: user.username };
}

export async function logout(token: string) {
  await deleteSession(token);
}

function extractChallengeFromClientData(clientDataJSON: string): string {
  try {
    const decoded = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf-8'));
    return decoded.challenge ?? '';
  } catch {
    return '';
  }
}

type AuthenticatorTransport =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';
