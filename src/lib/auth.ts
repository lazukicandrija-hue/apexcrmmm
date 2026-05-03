import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'apex-crm-secret-key-2026-change-in-production';

export interface UserPayload {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'agent';
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
    { expiresIn: '24h' }
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

export function getCurrentUser(cookieHeader: string | null): UserPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/apex_token=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}
