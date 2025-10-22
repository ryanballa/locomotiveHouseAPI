// test/addresses.model.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as addressesModel from '../src/addresses/model';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';

// Mock database type
type MockDB = NeonHttpDatabase<Record<string, never>>;

describe('Address Model', () => {
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

	describe('createAddress', () => {
		it('should reject creation without required fields', async () => {
			const result = await addressesModel.createAddress(mockDb, {
				id: 1,
				number: 0,
				description: '',
				in_use: false,
				user_id: 0,
				club_id: 0,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing required field/);
		});

		it('should reject creation without club_id', async () => {
			const result = await addressesModel.createAddress(mockDb, {
				id: 1,
				number: 3,
				description: 'Test Address',
				in_use: true,
				user_id: 1,
				club_id: 0,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/club_id/);
		});

		it('should reject creation without user_id', async () => {
			const result = await addressesModel.createAddress(mockDb, {
				id: 1,
				number: 3,
				description: 'Test Address',
				in_use: true,
				user_id: 0,
				club_id: 1,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing required field/);
		});

		it('should reject creation when address number already exists in club', async () => {
			// Mock the database query to return existing address
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							id: 1,
							number: 3,
							description: 'Existing',
							in_use: true,
							user_id: 2,
							club_id: 1,
						},
					]),
				}),
			});

			mockDb.select = mockSelect;

			const result = await addressesModel.createAddress(mockDb, {
				id: 2,
				number: 3,
				description: 'Test Address',
				in_use: true,
				user_id: 1,
				club_id: 1,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/already exists in this club/);
		});

		it('should allow same address number in different clubs', async () => {
			// Mock query - no existing addresses in this club
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});

			// Mock insert
			const mockInsert = vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 2,
							number: 3,
							description: 'Test Address',
							in_use: true,
							user_id: 1,
							club_id: 2,
						},
					]),
				}),
			});

			mockDb.select = mockSelect;
			mockDb.insert = mockInsert;

			const result = await addressesModel.createAddress(mockDb, {
				id: 2,
				number: 3,
				description: 'Test Address',
				in_use: true,
				user_id: 1,
				club_id: 2,
			});

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data?.[0]?.club_id).toBe(2);
		});

		it('should create address with all required fields', async () => {
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});

			const mockInsert = vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 1,
							number: 5,
							description: 'Engine Service',
							in_use: true,
							user_id: 3,
							club_id: 2,
						},
					]),
				}),
			});

			mockDb.select = mockSelect;
			mockDb.insert = mockInsert;

			const result = await addressesModel.createAddress(mockDb, {
				id: 1,
				number: 5,
				description: 'Engine Service',
				in_use: true,
				user_id: 3,
				club_id: 2,
			});

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data?.[0]).toEqual({
				id: 1,
				number: 5,
				description: 'Engine Service',
				in_use: true,
				user_id: 3,
				club_id: 2,
			});
		});
	});

	describe('updateAddress', () => {
		it('should reject update without required fields', async () => {
			const result = await addressesModel.updateAddress(mockDb, '1', {
				id: 1,
				number: 0,
				description: '',
				in_use: false,
				user_id: 0,
				club_id: 0,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing required field/);
		});

		it('should reject update without club_id', async () => {
			const result = await addressesModel.updateAddress(mockDb, '1', {
				id: 1,
				number: 3,
				description: 'Test',
				in_use: true,
				user_id: 1,
				club_id: 0,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/club_id/);
		});

		it('should reject update without address ID', async () => {
			const result = await addressesModel.updateAddress(mockDb, '', {
				id: 1,
				number: 3,
				description: 'Test',
				in_use: true,
				user_id: 1,
				club_id: 1,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing ID/);
		});

		it('should reject update when number conflicts with another address in same club', async () => {
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							id: 2,
							number: 3,
							description: 'Other Address',
							in_use: true,
							user_id: 2,
							club_id: 1,
						},
					]),
				}),
			});

			mockDb.select = mockSelect;

			const result = await addressesModel.updateAddress(mockDb, '1', {
				id: 1,
				number: 3,
				description: 'Updated',
				in_use: true,
				user_id: 1,
				club_id: 1,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/already exists in this club/);
		});

		it('should allow updating address to same number (no change)', async () => {
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							id: 1,
							number: 3,
							description: 'Original',
							in_use: true,
							user_id: 1,
							club_id: 1,
						},
					]),
				}),
			});

			const mockUpdate = vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([
							{
								id: 1,
								number: 3,
								description: 'Updated Description',
								in_use: true,
								user_id: 1,
								club_id: 1,
							},
						]),
					}),
				}),
			});

			mockDb.select = mockSelect;
			mockDb.update = mockUpdate;

			const result = await addressesModel.updateAddress(mockDb, '1', {
				id: 1,
				number: 3,
				description: 'Updated Description',
				in_use: true,
				user_id: 1,
				club_id: 1,
			});

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data?.[0]?.description).toBe('Updated Description');
		});

		it('should update address with new valid number in same club', async () => {
			// No conflicts
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});

			const mockUpdate = vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([
							{
								id: 1,
								number: 7,
								description: 'Updated Address',
								in_use: true,
								user_id: 1,
								club_id: 1,
							},
						]),
					}),
				}),
			});

			mockDb.select = mockSelect;
			mockDb.update = mockUpdate;

			const result = await addressesModel.updateAddress(mockDb, '1', {
				id: 1,
				number: 7,
				description: 'Updated Address',
				in_use: true,
				user_id: 1,
				club_id: 1,
			});

			expect(result.error).toBeUndefined();
			expect(result.data?.[0]?.number).toBe(7);
		});

		it('should allow changing club when number is unique in target club', async () => {
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});

			const mockUpdate = vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([
							{
								id: 1,
								number: 3,
								description: 'Address in Different Club',
								in_use: true,
								user_id: 1,
								club_id: 3,
							},
						]),
					}),
				}),
			});

			mockDb.select = mockSelect;
			mockDb.update = mockUpdate;

			const result = await addressesModel.updateAddress(mockDb, '1', {
				id: 1,
				number: 3,
				description: 'Address in Different Club',
				in_use: true,
				user_id: 1,
				club_id: 3,
			});

			expect(result.error).toBeUndefined();
			expect(result.data?.[0]?.club_id).toBe(3);
		});
	});

	describe('deleteAddress', () => {
		it('should reject deletion without address ID', async () => {
			const result = await addressesModel.deleteAddress(mockDb, '');

			expect(result.error).toBeDefined();
			expect(result.error).toMatch(/Missing ID/);
		});

		it('should delete address successfully', async () => {
			const mockDelete = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 1,
							number: 3,
							description: 'Deleted Address',
							in_use: false,
							user_id: 1,
							club_id: 1,
						},
					]),
				}),
			});

			mockDb.delete = mockDelete;

			const result = await addressesModel.deleteAddress(mockDb, '1');

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data?.[0]?.id).toBe(1);
		});
	});

	describe('Per-Club Uniqueness Constraint', () => {
		it('should prevent duplicate address numbers within same club', async () => {
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							id: 10,
							number: 5,
							description: 'First Address',
							in_use: true,
							user_id: 1,
							club_id: 1,
						},
					]),
				}),
			});

			mockDb.select = mockSelect;

			const result = await addressesModel.createAddress(mockDb, {
				id: 11,
				number: 5,
				description: 'Second Address Same Club',
				in_use: true,
				user_id: 2,
				club_id: 1,
			});

			expect(result.error).toBeDefined();
			expect(result.error).toContain('5');
			expect(result.error).toContain('already exists in this club');
		});

		it('should allow same address number in different clubs by same user', async () => {
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});

			const mockInsert = vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 20,
							number: 3,
							description: 'Address in Club 1',
							in_use: true,
							user_id: 1,
							club_id: 1,
						},
					]),
				}),
			});

			mockDb.select = mockSelect;
			mockDb.insert = mockInsert;

			// First address in club 1
			const result1 = await addressesModel.createAddress(mockDb, {
				id: 20,
				number: 3,
				description: 'Address in Club 1',
				in_use: true,
				user_id: 1,
				club_id: 1,
			});

			expect(result1.error).toBeUndefined();

			// Reset mock and second address in club 2 with same number
			mockDb.select = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});

			mockDb.insert = vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 21,
							number: 3,
							description: 'Address in Club 2',
							in_use: true,
							user_id: 1,
							club_id: 2,
						},
					]),
				}),
			});

			const result2 = await addressesModel.createAddress(mockDb, {
				id: 21,
				number: 3,
				description: 'Address in Club 2',
				in_use: true,
				user_id: 1,
				club_id: 2,
			});

			expect(result2.error).toBeUndefined();
			expect(result2.data?.[0]?.club_id).toBe(2);
		});
	});
});
