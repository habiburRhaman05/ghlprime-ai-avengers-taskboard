import 'server-only';
import { cache } from 'react';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import prisma from './prisma';
import { query } from './db';
import { hashPassword, verifyPassword } from './password';
import type { Role } from './rules';

const SESSION_COOKIE = 'ghl_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET is required.');
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('hex');
}

function signSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function sessionUserId(token: string): string | null {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const userId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = Buffer.from(sign(userId), 'hex');
  const actual = Buffer.from(signature, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return userId;
}

export type Actor = { id: string; name: string; role: Role; email: string };

async function portalActor(user: { id: string; name: string; role: Role; email: string }): Promise<Actor | null> {
  const { rows } = await query<{ id: string; role: Role }>(
    'SELECT id, role FROM portal.users WHERE lower(email)=lower($1)', [user.email]);
  const profile = rows[0];
  if (!profile || profile.role !== user.role) return null;
  return { id: profile.id, name: user.name, role: user.role, email: user.email };
}

export const actor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = sessionUserId(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return portalActor(user);
});

export async function requireActor() {
  const user = await actor();
  if (!user) redirect('/login');
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireActor();
  if (user.role !== 'super_admin') notFound();
  return user;
}

export async function authenticate(email: string, password: string): Promise<Actor | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;
  return portalActor(user);
}

export async function createSession(user: Actor) {
  const account = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } });
  if (!account) throw new Error('Account unavailable.');
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(account.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
}

export async function changePassword(email: string, newPassword: string) {
  await prisma.user.update({
    where: { email },
    data: { password_hash: await hashPassword(newPassword) },
  });
}
