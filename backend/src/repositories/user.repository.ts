import { query } from '../db/connection.js';

interface UserRow {
  id: number;
  username: string;
  valid: boolean;
}

interface CredentialRow {
  id: string;
  user_id: number;
  public_key: Buffer;
  counter: number;
  transports: string[];
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const result = await query<UserRow>('SELECT id, username, valid FROM users WHERE username = $1', [
    username,
  ]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const result = await query<UserRow>('SELECT id, username, valid FROM users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function createUser(username: string): Promise<UserRow> {
  const result = await query<UserRow>(
    'INSERT INTO users (username, valid) VALUES ($1, FALSE) RETURNING id, username, valid',
    [username],
  );
  return result.rows[0];
}

export async function getCredentialsByUserId(userId: number): Promise<CredentialRow[]> {
  const result = await query<CredentialRow>(
    'SELECT id, user_id, public_key, counter::int, transports FROM credentials WHERE user_id = $1',
    [userId],
  );
  return result.rows;
}

export async function getCredentialById(credId: string): Promise<CredentialRow | null> {
  const result = await query<CredentialRow>(
    'SELECT id, user_id, public_key, counter::int, transports FROM credentials WHERE id = $1',
    [credId],
  );
  return result.rows[0] ?? null;
}

export async function createCredential(
  id: string,
  userId: number,
  publicKey: Buffer,
  counter: number,
  transports: string[],
): Promise<void> {
  await query(
    'INSERT INTO credentials (id, user_id, public_key, counter, transports) VALUES ($1, $2, $3, $4, $5)',
    [id, userId, publicKey, counter, transports],
  );
}

export async function updateCredentialCounter(id: string, counter: number): Promise<void> {
  await query('UPDATE credentials SET counter = $1 WHERE id = $2', [counter, id]);
}

export async function saveChallenge(challenge: string, username?: string): Promise<void> {
  await query(
    "INSERT INTO challenges (challenge, username, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')",
    [challenge, username ?? null],
  );
}

export async function consumeChallenge(challenge: string, username?: string): Promise<boolean> {
  await query('DELETE FROM challenges WHERE expires_at < NOW()');
  const sql = username
    ? 'DELETE FROM challenges WHERE challenge = $1 AND username = $2 AND expires_at > NOW() RETURNING id'
    : 'DELETE FROM challenges WHERE challenge = $1 AND username IS NULL AND expires_at > NOW() RETURNING id';
  const params = username ? [challenge, username] : [challenge];
  const result = await query(sql, params);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function createSession(token: string, userId: number, expiresAt: Date): Promise<void> {
  await query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    userId,
    expiresAt,
  ]);
}

export async function getSession(
  token: string,
): Promise<{ user_id: number; expires_at: Date } | null> {
  const result = await query<{ user_id: number; expires_at: Date }>(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token = $1', [token]);
}
