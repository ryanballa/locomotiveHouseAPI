// test/scheduledSessions.model.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as scheduledSessionsModel from '../src/scheduledSessions/model';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';

// Mock database type
type MockDB = NeonHttpDatabase<Record<string, never>>;

describe('ScheduledSessions Model', () => {
	let mockDb: MockDB;

	beforeEach(() => {
		// Create a mock database with select, insert, update, delete methods
		mockDb = {
			select: vi.fn(),
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		} as any;
	});

	describe('createScheduledSession', () => {
		it('should reject creation without data', async () => {
			const result = await scheduledSessionsModel.createScheduledSession(mockDb, null as any);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing data/);
		});

		it('should reject creation without schedule', async () => {
			const result = await scheduledSessionsModel.createScheduledSession(mockDb, {
				id: 0,
				schedule: null as any,
				club_id: 1,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing required fields/);
		});

		it('should reject creation without club_id', async () => {
			const result = await scheduledSessionsModel.createScheduledSession(mockDb, {
				id: 0,
				schedule: new Date('2024-12-20'),
				club_id: 0,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing required fields/);
		});

		it('should reject creation if club does not exist', async () => {
			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.createScheduledSession(mockDb, {
				id: 0,
				schedule: new Date('2024-12-20'),
				club_id: 999,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Club not found/);
		});

		it('should successfully create a scheduled session', async () => {
			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ id: 1, name: 'Test Club' }]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			mockDb.insert = vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 1,
							schedule: new Date('2024-12-20'),
							club_id: 1,
						},
					]),
				}),
			});

			const result = await scheduledSessionsModel.createScheduledSession(mockDb, {
				id: 0,
				schedule: new Date('2024-12-20'),
				club_id: 1,
			});

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data).toEqual([
				{
					id: 1,
					schedule: new Date('2024-12-20'),
					club_id: 1,
				},
			]);
		});
	});

	describe('getScheduledSessionById', () => {
		it('should reject query without ID', async () => {
			const result = await scheduledSessionsModel.getScheduledSessionById(mockDb, '');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing ID/);
		});

		it('should return null if session does not exist', async () => {
			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.getScheduledSessionById(mockDb, '999');

			expect(result.error).toBeUndefined();
			expect(result.data).toBeNull();
		});

		it('should successfully retrieve a scheduled session by ID', async () => {
			const session = {
				id: 1,
				schedule: new Date('2024-12-20'),
				club_id: 1,
			};

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([session]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.getScheduledSessionById(mockDb, '1');

			expect(result.error).toBeUndefined();
			expect(result.data).toEqual([session]);
		});
	});

	describe('getScheduledSessionsByClubId', () => {
		it('should reject query without club ID', async () => {
			const result = await scheduledSessionsModel.getScheduledSessionsByClubId(mockDb, '');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing club ID/);
		});

		it('should return empty array if no sessions exist for club', async () => {
			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.getScheduledSessionsByClubId(mockDb, '1');

			expect(result.error).toBeUndefined();
			expect(result.data).toEqual([]);
		});

		it('should successfully retrieve all sessions for a club', async () => {
			const sessions = [
				{
					id: 1,
					schedule: new Date('2024-12-20'),
					club_id: 1,
				},
				{
					id: 2,
					schedule: new Date('2024-12-25'),
					club_id: 1,
				},
			];

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(sessions),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.getScheduledSessionsByClubId(mockDb, '1');

			expect(result.error).toBeUndefined();
			expect(result.data).toEqual(sessions);
			expect(result.data?.length).toBe(2);
		});

		it('should accept numeric club ID', async () => {
			const sessions = [
				{
					id: 1,
					schedule: new Date('2024-12-20'),
					club_id: 1,
				},
			];

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(sessions),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.getScheduledSessionsByClubId(mockDb, 1);

			expect(result.error).toBeUndefined();
			expect(result.data).toEqual(sessions);
		});
	});

	describe('getScheduledSessionsByDateRange', () => {
		it('should reject query without club ID', async () => {
			const result = await scheduledSessionsModel.getScheduledSessionsByDateRange(
				mockDb,
				'',
				new Date('2024-01-01'),
				new Date('2024-12-31')
			);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing club ID/);
		});

		it('should reject query without start date', async () => {
			const result = await scheduledSessionsModel.getScheduledSessionsByDateRange(
				mockDb,
				'1',
				null as any,
				new Date('2024-12-31')
			);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing date range/);
		});

		it('should reject query without end date', async () => {
			const result = await scheduledSessionsModel.getScheduledSessionsByDateRange(
				mockDb,
				'1',
				new Date('2024-01-01'),
				null as any
			);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing date range/);
		});

		it('should successfully retrieve sessions within date range', async () => {
			const sessions = [
				{
					id: 1,
					schedule: new Date('2024-06-15'),
					club_id: 1,
				},
				{
					id: 2,
					schedule: new Date('2024-06-20'),
					club_id: 1,
				},
			];

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(sessions),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.getScheduledSessionsByDateRange(
				mockDb,
				'1',
				new Date('2024-01-01'),
				new Date('2024-12-31')
			);

			expect(result.error).toBeUndefined();
			expect(result.data).toEqual(sessions);
		});
	});

	describe('updateScheduledSession', () => {
		it('should reject update without data', async () => {
			const result = await scheduledSessionsModel.updateScheduledSession(mockDb, '1', null as any);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing data/);
		});

		it('should reject update without ID', async () => {
			const result = await scheduledSessionsModel.updateScheduledSession(mockDb, '', {
				schedule: new Date('2024-12-25'),
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing ID/);
		});

		it('should reject update if session does not exist', async () => {
			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.updateScheduledSession(mockDb, '999', {
				schedule: new Date('2024-12-25'),
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Scheduled session not found/);
		});

		it('should reject update if new club does not exist', async () => {
			const whereChain = {
				mockResolvedValueOnce: vi.fn(),
			};

			const fromMock = vi.fn().mockReturnValue({
				where: vi
					.fn()
					.mockResolvedValueOnce([
						{
							id: 1,
							schedule: new Date('2024-12-20'),
							club_id: 1,
						},
					])
					.mockResolvedValueOnce([]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await scheduledSessionsModel.updateScheduledSession(mockDb, '1', {
				club_id: 999,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Club not found/);
		});

		it('should successfully update schedule date', async () => {
			const fromMock = vi.fn().mockReturnValue({
				where: vi
					.fn()
					.mockResolvedValueOnce([
						{
							id: 1,
							schedule: new Date('2024-12-20'),
							club_id: 1,
						},
					]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			mockDb.update = vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([
							{
								id: 1,
								schedule: new Date('2024-12-25'),
								club_id: 1,
							},
						]),
					}),
				}),
			});

			const result = await scheduledSessionsModel.updateScheduledSession(mockDb, '1', {
				schedule: new Date('2024-12-25'),
			});

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data?.[0]?.schedule).toEqual(new Date('2024-12-25'));
		});

		it('should successfully update club_id', async () => {
			const fromMock = vi.fn().mockReturnValue({
				where: vi
					.fn()
					.mockResolvedValueOnce([
						{
							id: 1,
							schedule: new Date('2024-12-20'),
							club_id: 1,
						},
					])
					.mockResolvedValueOnce([{ id: 2, name: 'New Club' }]),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			mockDb.update = vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([
							{
								id: 1,
								schedule: new Date('2024-12-20'),
								club_id: 2,
							},
						]),
					}),
				}),
			});

			const result = await scheduledSessionsModel.updateScheduledSession(mockDb, '1', {
				club_id: 2,
			});

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data?.[0]?.club_id).toEqual(2);
		});
	});

	describe('deleteScheduledSession', () => {
		it('should reject deletion without ID', async () => {
			const result = await scheduledSessionsModel.deleteScheduledSession(mockDb, '');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing ID/);
		});

		it('should successfully delete a scheduled session', async () => {
			mockDb.delete = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 1,
							schedule: new Date('2024-12-20'),
							club_id: 1,
						},
					]),
				}),
			});

			const result = await scheduledSessionsModel.deleteScheduledSession(mockDb, '1');

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data).toEqual([
				{
					id: 1,
					schedule: new Date('2024-12-20'),
					club_id: 1,
				},
			]);
		});

		it('should verify delete was called with correct ID', async () => {
			const whereMock = vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([]),
			});

			const deleteMock = vi.fn().mockReturnValue({
				where: whereMock,
			});

			mockDb.delete = deleteMock;

			await scheduledSessionsModel.deleteScheduledSession(mockDb, '5');

			expect(deleteMock).toHaveBeenCalled();
		});
	});

	describe('deleteScheduledSessionsByClubId', () => {
		it('should reject deletion without club ID', async () => {
			const result = await scheduledSessionsModel.deleteScheduledSessionsByClubId(mockDb, '');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing club ID/);
		});

		it('should successfully delete all sessions for a club', async () => {
			mockDb.delete = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 1,
							schedule: new Date('2024-12-20'),
							club_id: 1,
						},
						{
							id: 2,
							schedule: new Date('2024-12-25'),
							club_id: 1,
						},
					]),
				}),
			});

			const result = await scheduledSessionsModel.deleteScheduledSessionsByClubId(mockDb, '1');

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data?.length).toBe(2);
		});

		it('should return empty array if no sessions exist for club', async () => {
			mockDb.delete = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([]),
				}),
			});

			const result = await scheduledSessionsModel.deleteScheduledSessionsByClubId(mockDb, '999');

			expect(result.error).toBeUndefined();
			expect(result.data).toEqual([]);
		});

		it('should accept numeric club ID', async () => {
			mockDb.delete = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 1,
							schedule: new Date('2024-12-20'),
							club_id: 1,
						},
					]),
				}),
			});

			const result = await scheduledSessionsModel.deleteScheduledSessionsByClubId(mockDb, 1);

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
		});
	});
});
