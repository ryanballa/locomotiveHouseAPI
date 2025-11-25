import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emailQueueModel, CreateEmailQueueRequest, EmailQueueItem } from './model';

// Mock data
const mockEmail: EmailQueueItem = {
	id: 1,
	recipient_email: 'test@example.com',
	subject: 'Test Subject',
	body: 'Test Body',
	html_body: '<p>Test Body</p>',
	status: 'pending',
	retry_count: 0,
	max_retries: 3,
	last_error: null,
	scheduled_at: null,
	sent_at: null,
	created_at: new Date('2025-11-22'),
	updated_at: new Date('2025-11-22'),
};

const mockDb = {
	insert: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
};

describe('Email Queue Model', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('createEmail', () => {
		it('should create an email with required fields', async () => {
			mockDb.insert.mockReturnValueOnce({
				values: vi.fn().mockReturnValueOnce({
					returning: vi.fn().mockResolvedValueOnce([mockEmail]),
				}),
			});

			const request: CreateEmailQueueRequest = {
				recipient_email: 'test@example.com',
				subject: 'Test Subject',
				body: 'Test Body',
			};

			const result = await emailQueueModel.createEmail(mockDb, request);

			expect(result.data).toBeDefined();
			expect(result.data?.recipient_email).toBe('test@example.com');
			expect(result.error).toBeUndefined();
		});

		it('should handle creation errors', async () => {
			mockDb.insert.mockImplementationOnce(() => {
				throw new Error('Database error');
			});

			const request: CreateEmailQueueRequest = {
				recipient_email: 'test@example.com',
				subject: 'Test Subject',
				body: 'Test Body',
			};

			const result = await emailQueueModel.createEmail(mockDb, request);

			expect(result.error).toBeDefined();
			expect(result.data).toBeUndefined();
		});
	});

	describe('getEmail', () => {
		it('should retrieve an email by ID', async () => {
			mockDb.select.mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([mockEmail]),
				}),
			});

			const result = await emailQueueModel.getEmail(mockDb, 1);

			expect(result.data).toBeDefined();
			expect(result.data?.id).toBe(1);
			expect(result.error).toBeUndefined();
		});

		it('should return error when email not found', async () => {
			mockDb.select.mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([]),
				}),
			});

			const result = await emailQueueModel.getEmail(mockDb, 999);

			expect(result.error).toBeDefined();
			expect(result.data).toBeUndefined();
		});
	});

	describe('listEmails', () => {
		it('should list all emails', async () => {
			mockDb.select.mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					orderBy: vi
						.fn()
						.mockReturnValueOnce({
							limit: vi.fn().mockReturnValueOnce({
								offset: vi.fn().mockResolvedValueOnce([mockEmail]),
							}),
						}),
				}),
			});

			const result = await emailQueueModel.listEmails(mockDb, { limit: 10 });

			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should filter by status', async () => {
			mockDb.select.mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi
						.fn()
						.mockReturnValueOnce({
							orderBy: vi
								.fn()
								.mockReturnValueOnce({
									limit: vi.fn().mockReturnValueOnce({
										offset: vi.fn().mockResolvedValueOnce([mockEmail]),
									}),
								}),
						}),
				}),
			});

			const result = await emailQueueModel.listEmails(mockDb, { status: 'pending' });

			expect(result.data).toBeDefined();
			expect(result.error).toBeUndefined();
		});
	});

	describe('updateEmail', () => {
		it('should update email status', async () => {
			const updatedEmail = { ...mockEmail, status: 'sent' as const };
			mockDb.update.mockReturnValueOnce({
				set: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockReturnValueOnce({
						returning: vi.fn().mockResolvedValueOnce([updatedEmail]),
					}),
				}),
			});

			const result = await emailQueueModel.updateEmail(mockDb, 1, { status: 'sent' });

			expect(result.data).toBeDefined();
			expect(result.data?.status).toBe('sent');
			expect(result.error).toBeUndefined();
		});

		it('should return error when email not found', async () => {
			mockDb.update.mockReturnValueOnce({
				set: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockReturnValueOnce({
						returning: vi.fn().mockResolvedValueOnce([]),
					}),
				}),
			});

			const result = await emailQueueModel.updateEmail(mockDb, 999, { status: 'sent' });

			expect(result.error).toBeDefined();
			expect(result.data).toBeUndefined();
		});
	});

	describe('deleteEmail', () => {
		it('should delete an email', async () => {
			mockDb.delete.mockReturnValueOnce({
				where: vi.fn().mockReturnValueOnce({
					returning: vi.fn().mockResolvedValueOnce([mockEmail]),
				}),
			});

			const result = await emailQueueModel.deleteEmail(mockDb, 1);

			expect(result.data).toBeDefined();
			expect(result.data?.id).toBe(1);
			expect(result.error).toBeUndefined();
		});

		it('should return error when email not found', async () => {
			mockDb.delete.mockReturnValueOnce({
				where: vi.fn().mockReturnValueOnce({
					returning: vi.fn().mockResolvedValueOnce([]),
				}),
			});

			const result = await emailQueueModel.deleteEmail(mockDb, 999);

			expect(result.error).toBeDefined();
			expect(result.data).toBeUndefined();
		});
	});

	describe('getPendingEmails', () => {
		it('should retrieve pending emails', async () => {
			mockDb.select.mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockReturnValueOnce({
						orderBy: vi.fn().mockReturnValueOnce({
							limit: vi.fn().mockResolvedValueOnce([mockEmail]),
						}),
					}),
				}),
			});

			const result = await emailQueueModel.getPendingEmails(mockDb, 10);

			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe('getFailedEmails', () => {
		it('should retrieve failed emails', async () => {
			const failedEmail = { ...mockEmail, status: 'failed' as const };
			mockDb.select.mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockReturnValueOnce({
						orderBy: vi.fn().mockReturnValueOnce({
							limit: vi.fn().mockResolvedValueOnce([failedEmail]),
						}),
					}),
				}),
			});

			const result = await emailQueueModel.getFailedEmails(mockDb, 10);

			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});
});
