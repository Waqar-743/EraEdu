process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-ok';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_KEY = 'placeholder-anon-key';
process.env.NODE_ENV = 'test';

const mockFrom = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: { from: mockFrom } }));
jest.mock('../services/emailService', () => ({ emailService: {} }));
jest.mock('../controllers/profilePictureController', () => ({ uploadProfilePicture: jest.fn(), uploadRegistrationPicture: jest.fn() }));

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authService } from '../services/authService';
import authRoutes from '../routes/auth';

const currentPassword = 'CurrentPass1';
const newPassword = 'UpdatedPass2';
const userId = 'account-1';
let currentHash: string;

beforeAll(async () => { currentHash = await bcrypt.hash(currentPassword, 4); });
beforeEach(() => mockFrom.mockReset());

function setup({ concurrent = false, updateError = null as any } = {}) {
  let patch: any;
  const filters: [string, string][] = [];
  const query: any = {
    select: () => query,
    eq: (key: string, value: string) => { filters.push([key, value]); return query; },
    single: async () => ({ data: { id: userId, password: currentHash }, error: null }),
    update: jest.fn((value: any) => { patch = value; return query; }),
    maybeSingle: async () => ({ data: concurrent ? null : { id: userId }, error: updateError }),
  };
  mockFrom.mockReturnValue(query);
  return { query, filters, getPatch: () => patch };
}

it('checks the current password, stores a hash, and clears outstanding reset links', async () => {
  const { filters, getPatch } = setup();
  await expect(authService.changePassword(userId, currentPassword, newPassword)).resolves.toEqual({ message: 'Your password has been changed.' });
  const patch = getPatch();
  expect(patch.password).not.toBe(newPassword);
  expect(await bcrypt.compare(newPassword, patch.password)).toBe(true);
  expect(patch).toMatchObject({ reset_password_token: null, reset_password_expires_at: null });
  expect(filters).toEqual([['id', userId], ['id', userId], ['password', currentHash]]);
});

it('rejects an incorrect current password without writing', async () => {
  const { query } = setup();
  await expect(authService.changePassword(userId, 'WrongPass1', newPassword)).rejects.toMatchObject({ statusCode: 400, message: 'Your current password is incorrect' });
  expect(query.update).not.toHaveBeenCalled();
});

it.each(['short', 'no-uppercase1', 'NOLOWERCASE1', 'NoNumberHere', 'A'.repeat(129)])('rejects invalid new passwords before a database lookup: %s', async (password) => {
  await expect(authService.changePassword(userId, currentPassword, password)).rejects.toMatchObject({ statusCode: 400 });
  expect(mockFrom).not.toHaveBeenCalled();
});

it('rejects reuse of the current password without writing', async () => {
  const { query } = setup();
  await expect(authService.changePassword(userId, currentPassword, currentPassword)).rejects.toMatchObject({ statusCode: 400 });
  expect(query.update).not.toHaveBeenCalled();
});

it('does not overwrite a password changed concurrently', async () => {
  setup({ concurrent: true });
  await expect(authService.changePassword(userId, currentPassword, newPassword)).rejects.toMatchObject({ statusCode: 409 });
});

it('reports failed persistence instead of claiming success', async () => {
  setup({ updateError: { message: 'Database unavailable' } });
  await expect(authService.changePassword(userId, currentPassword, newPassword)).rejects.toThrow('Unable to change your password');
});

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

it('requires authentication on the password-change route', async () => {
  await request(app).put('/auth/change-password').send({ currentPassword, newPassword }).expect(401);
  expect(mockFrom).not.toHaveBeenCalled();
});

it('validates authenticated password changes before the service runs', async () => {
  const query: any = { select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { id: userId, role: 'teacher', is_suspended: false }, error: null }) };
  mockFrom.mockReturnValue(query);
  const token = jwt.sign({ id: userId, role: 'teacher' }, process.env.JWT_SECRET!);
  const response = await request(app).put('/auth/change-password').set('Authorization', `Bearer ${token}`)
    .send({ currentPassword, newPassword: 'weak' }).expect(400);
  expect(response.body.success).toBe(false);
  // Only the live-account lookup in protect ran; the credentials lookup did not.
  expect(mockFrom).toHaveBeenCalledTimes(1);
});

it('changes only the authenticated account and returns no credential data', async () => {
  const { filters } = setup();
  const accountQuery: any = { select: () => accountQuery, eq: () => accountQuery,
    maybeSingle: async () => ({ data: { id: userId, role: 'teacher', is_suspended: false }, error: null }) };
  mockFrom.mockReturnValueOnce(accountQuery);
  const token = jwt.sign({ id: userId, role: 'teacher' }, process.env.JWT_SECRET!);
  const response = await request(app).put('/auth/change-password').set('Authorization', `Bearer ${token}`)
    .send({ currentPassword, newPassword, userId: 'another-account' }).expect(200);
  expect(response.body).toEqual({ success: true, data: { message: 'Your password has been changed.' } });
  expect(filters).toEqual([['id', userId], ['id', userId], ['password', currentHash]]);
});
