// test/users.model.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as usersModel from '../src/users/model';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';

// Mock database type
type MockDB = NeonHttpDatabase<Record<string, never>>;

describe('Users Model', () => {
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

	describe('assignClubToUser', () => {
		it('should reject assignment without user ID', async () => {
			const result = await usersModel.assignClubToUser(mockDb, '', 1);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing user ID/);
		});

		it('should reject assignment without club ID', async () => {
			const result = await usersModel.assignClubToUser(mockDb, '1', 0);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing club ID/);
		});

		it('should reject assignment if user does not exist', async () => {
			const whereMock = vi.fn().mockReturnValue({
				limit: vi.fn().mockResolvedValue([]),
			});

			const fromMock = vi.fn().mockReturnValue({
				where: whereMock,
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await usersModel.assignClubToUser(mockDb, '999', 1);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/User not found/);
		});

		it('should reject assignment if club does not exist', async () => {
			const whereChain = {
				limit: vi
					.fn()
					.mockResolvedValueOnce([{ id: 1, token: 'test', permission: 1 }])
					.mockResolvedValueOnce([]),
			};

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue(whereChain),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await usersModel.assignClubToUser(mockDb, '1', 999);

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Club not found/);
		});

		it('should successfully assign club to user', async () => {
			const whereChain = {
				limit: vi
					.fn()
					.mockResolvedValueOnce([{ id: 1, token: 'test', permission: 1 }])
					.mockResolvedValueOnce([{ id: 1, name: 'Test Club' }]),
			};

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue(whereChain),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			mockDb.insert = vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					onConflictDoNothing: vi.fn().mockReturnValue({
						returning: vi
							.fn()
							.mockResolvedValue([{ user_id: 1, club_id: 1 }]),
					}),
				}),
			});

			const result = await usersModel.assignClubToUser(mockDb, '1', 1);

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data).toEqual([{ user_id: 1, club_id: 1 }]);
		});
	});

	describe('removeClubFromUser', () => {
		it('should reject removal without user ID', async () => {
			const result = await usersModel.removeClubFromUser(mockDb, '', '1');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing user ID/);
		});

		it('should reject removal without club ID', async () => {
			const result = await usersModel.removeClubFromUser(mockDb, '1', '');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing club ID/);
		});

		it('should reject removal if user does not exist', async () => {
			const whereMock = vi.fn().mockReturnValue({
				limit: vi.fn().mockResolvedValue([]),
			});

			const fromMock = vi.fn().mockReturnValue({
				where: whereMock,
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await usersModel.removeClubFromUser(mockDb, '999', '1');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/User not found/);
		});

		it('should reject removal if club does not exist', async () => {
			const whereChain = {
				limit: vi
					.fn()
					.mockResolvedValueOnce([{ id: 1, token: 'test', permission: 1 }])
					.mockResolvedValueOnce([]),
			};

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue(whereChain),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			const result = await usersModel.removeClubFromUser(mockDb, '1', '999');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Club not found/);
		});

		it('should only remove the specific user-club assignment, not all assignments', async () => {
			const whereChain = {
				limit: vi
					.fn()
					.mockResolvedValueOnce([{ id: 1, token: 'test', permission: 1 }])
					.mockResolvedValueOnce([{ id: 1, name: 'Test Club' }]),
			};

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue(whereChain),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			mockDb.delete = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi
						.fn()
						.mockResolvedValue([{ user_id: 1, club_id: 1 }]),
				}),
			});

			const result = await usersModel.removeClubFromUser(mockDb, '1', '1');

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data).toEqual([{ user_id: 1, club_id: 1 }]);

			// Verify that delete was called
			expect(mockDb.delete).toHaveBeenCalled();
		});

		it('should not remove assignments for other users or clubs', async () => {
			const whereChain = {
				limit: vi
					.fn()
					.mockResolvedValueOnce([{ id: 5, token: 'test', permission: 1 }])
					.mockResolvedValueOnce([{ id: 3, name: 'Test Club' }]),
			};

			const fromMock = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue(whereChain),
			});

			mockDb.select = vi.fn().mockReturnValue({
				from: fromMock,
			});

			mockDb.delete = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi
						.fn()
						.mockResolvedValue([{ user_id: 5, club_id: 3 }]),
				}),
			});

			const result = await usersModel.removeClubFromUser(mockDb, '5', '3');

			expect(result.error).toBeUndefined();
			// The result should only contain the specific assignment that was deleted
			expect(result.data).toEqual([{ user_id: 5, club_id: 3 }]);
		});
	});
});
