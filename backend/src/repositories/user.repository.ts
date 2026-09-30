import { query } from '../db/connection.js';

interface UserRow {
  id: number;
  username: string;
  valid: boolean;
  admin: boolean;
}

interface UserDetailRow {
  id: number;
  username: string;
  valid: boolean;
  admin: boolean;
  created_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  last_login: Date | null;
  credential_count: number;
}

interface CredentialRow {
  id: string;
  user_id: number;
  public_key: Buffer;
  counter: number;
  transports: string[];
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    'SELECT id, username, valid, admin FROM users WHERE username = $1',
    [username],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const result = await query<UserRow>(
    'SELECT id, username, valid, admin FROM users WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createUser(
  username: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserRow> {
  const result = await query<UserRow>(
    'INSERT INTO users (username, valid, ip_address, user_agent) VALUES ($1, FALSE, $2, $3) RETURNING id, username, valid, admin',
    [username, ipAddress ?? null, userAgent ?? null],
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

export async function getValidSessionUser(token: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT u.id, u.username, u.valid, u.admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW() AND u.valid`,
    [token],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token = $1', [token]);
}

export async function getAllUsers(): Promise<UserDetailRow[]> {
  const result = await query<UserDetailRow>(
    `SELECT u.id, u.username, u.valid, u.admin, u.created_at, u.ip_address, u.user_agent, u.last_login,
            COUNT(c.id)::int AS credential_count
     FROM users u
     LEFT JOIN credentials c ON c.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
    [],
  );
  return result.rows;
}

export async function setUserValid(userId: number, valid: boolean): Promise<boolean> {
  const result = await query('UPDATE users SET valid = $1 WHERE id = $2 RETURNING id', [
    valid,
    userId,
  ]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function updateLastLogin(
  userId: number,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await query(
    'UPDATE users SET last_login = NOW(), ip_address = COALESCE($2, ip_address), user_agent = COALESCE($3, user_agent) WHERE id = $1',
    [userId, ipAddress ?? null, userAgent ?? null],
  );
}

export async function deleteUser(userId: number): Promise<boolean> {
  const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function setUserAdmin(userId: number, admin: boolean): Promise<boolean> {
  const result = await query('UPDATE users SET admin = $1 WHERE id = $2 RETURNING id', [
    admin,
    userId,
  ]);
  return result.rowCount !== null && result.rowCount > 0;
}
