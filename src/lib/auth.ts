import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db/database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'apex-crm-secret-key-2026-change-in-production';

export interface UserPayload {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'agent';
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  permissions: string[];
  created_by: string;
}

export function login(username: string, password: string): string | null {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as {
    id: string; username: string; password: string; full_name: string; role: string;
  } | undefined;

  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password)) return null;

  const token = jwt.sign(
    { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return token;
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function getCurrentUser(cookieHeader: string | null): UserPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/apex_token=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}

// --- API Key Functions ---

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `apex_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 12);
  const hash = bcrypt.hashSync(key, 10);
  return { key, hash, prefix };
}

export function createApiKey(name: string, createdBy: string, permissions: string[] = ['read', 'write']): { id: string; key: string; prefix: string } {
  const db = getDb();
  const id = uuidv4();
  const { key, hash, prefix } = generateApiKey();

  db.prepare(`
    INSERT INTO api_keys (id, name, key_hash, key_prefix, permissions, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, hash, prefix, JSON.stringify(permissions), createdBy);

  return { id, key, prefix };
}

export function validateApiKey(key: string): ApiKeyInfo | null {
  const db = getDb();
  const keys = db.prepare('SELECT * FROM api_keys WHERE active = 1').all() as {
    id: string; name: string; key_hash: string; permissions: string; created_by: string;
  }[];

  for (const k of keys) {
    if (bcrypt.compareSync(key, k.key_hash)) {
      // Update last_used_at
      db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(k.id);
      return {
        id: k.id,
        name: k.name,
        permissions: JSON.parse(k.permissions),
        created_by: k.created_by,
      };
    }
  }
  return null;
}

export function getAuthFromRequest(headersList: Headers): { user?: UserPayload; apiKey?: ApiKeyInfo } | null {
  // Try API key first (Authorization: Bearer apex_...)
  const authHeader = headersList.get('authorization');
  if (authHeader?.startsWith('Bearer apex_')) {
    const key = authHeader.replace('Bearer ', '');
    const apiKey = validateApiKey(key);
    if (apiKey) return { apiKey };
  }

  // Fall back to cookie auth
  const user = getCurrentUser(headersList.get('cookie'));
  if (user) return { user };

  return null;
}
