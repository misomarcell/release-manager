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
  updateLastLogin,
} from '../repositories/user.repository.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function startRegistration(username: string, ipAddress?: string, userAgent?: string) {
  const existingUser = await findUserByUsername(username);
  if (existingUser) {
    const existingCreds = await getCredentialsByUserId(existingUser.id);
    if (existingCreds.length > 0) {
      throw new Error('Username is already taken');
    }
  } else {
    await createUser(username, ipAddress, userAgent);
  }

  const options = await generateRegistrationOptions({
    rpName: config.rp.name,
    rpID: config.rp.id,
    userName: username,
    attestationType: 'none',
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

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: async (challenge) => consumeChallenge(challenge, username),
    expectedOrigin: config.rp.origin,
    expectedRPID: config.rp.id,
    requireUserVerification: false,
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
  if (!user.valid) throw new Error('Account not activated. Please try again later.');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: async (challenge) => {
      return await consumeChallenge(challenge);
    },
    expectedOrigin: config.rp.origin,
    expectedRPID: config.rp.id,
    requireUserVerification: false,
    credential: {
      id: cred.id,
      publicKey: new Uint8Array(cred.public_key),
      counter: cred.counter,
      transports: cred.transports as AuthenticatorTransport[],
    },
  });

  if (!verification.verified) throw new Error('Authentication verification failed');

  await updateCredentialCounter(credId, verification.authenticationInfo.newCounter);
  await updateLastLogin(user.id);

  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await createSession(token, user.id, expiresAt);

  return { token, expiresAt, username: user.username, admin: user.admin };
}

export async function validateSession(token: string) {
  const session = await getSession(token);
  if (!session) return null;

  const user = await findUserById(session.user_id);
  if (!user || !user.valid) return null;

  return { userId: user.id, username: user.username, admin: user.admin };
}

export async function logout(token: string) {
  await deleteSession(token);
}

type AuthenticatorTransport =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';
