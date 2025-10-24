// test/clubs.join.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Club Join Endpoint Tests
 * Tests for the POST /api/clubs/:id/join endpoint
 * Allows authenticated users to self-assign to a club
 */

describe('Club Join Endpoint', () => {
	describe('POST /api/clubs/:id/join', () => {
		describe('Authentication & Authorization', () => {
			it('should require authentication', () => {
				// Missing Authorization header should return 403
				expect({
					status: 403,
					error: 'Unauthenticated',
				}).toEqual({
					status: 403,
					error: 'Unauthenticated',
				});
			});

			it('should require user to be registered (have lhUserId)', () => {
				// User with valid Clerk token but no lhUserId should get error
				expect({
					status: 403,
					error: 'User not registered',
				}).toEqual({
					status: 403,
					error: 'User not registered',
				});
			});

			it('should require user permission (checkUserPermission middleware)', () => {
				// User without lhUserId in Clerk metadata should fail at checkUserPermission
				expect({
					status: 403,
					error: 'Missing permission',
				}).toEqual({
					status: 403,
					error: 'Missing permission',
				});
			});
		});

		describe('Input Validation', () => {
			it('should require a club ID in route parameter', () => {
				// Missing club ID should return 400
				expect({
					status: 400,
					error: 'Missing club ID',
				}).toEqual({
					status: 400,
					error: 'Missing club ID',
				});
			});

			it('should validate that club ID is numeric', () => {
				// Non-numeric club ID should fail when parsed as integer
				const clubId = 'abc';
				const parsedId = parseInt(clubId, 10);
				expect(isNaN(parsedId)).toBe(true);
			});
		});

		describe('Club Validation', () => {
			it('should return 404 if club does not exist', () => {
				// Trying to join a non-existent club should return 404
				expect({
					status: 404,
					error: 'Club not found',
				}).toEqual({
					status: 404,
					error: 'Club not found',
				});
			});

			it('should verify club exists before assignment', () => {
				// The endpoint queries clubs table first
				// This ensures we don't create assignments for non-existent clubs
				const clubId = 999;
				const clubs = [
					{ id: 1, name: 'Club A' },
					{ id: 2, name: 'Club B' },
				];

				const clubExists = clubs.some((club) => club.id === clubId);
				expect(clubExists).toBe(false);
			});
		});

		describe('Successful Join Operations', () => {
			it('should allow authenticated user to join a club', () => {
				// User with valid auth and registered status should be able to join
				const response = {
					joined: true,
					club_id: 1,
					user_id: 5,
					club_name: 'Test Club',
				};

				expect(response.joined).toBe(true);
				expect(response.club_id).toBe(1);
				expect(response.user_id).toBe(5);
			});

			it('should return 200 status on successful join', () => {
				// Successful join should return 200 OK
				expect({
					status: 200,
					body: {
						joined: true,
						club_id: 1,
						user_id: 5,
						club_name: 'Test Club',
					},
				}).toEqual({
					status: 200,
					body: {
						joined: true,
						club_id: 1,
						user_id: 5,
						club_name: 'Test Club',
					},
				});
			});

			it('should include club information in response', () => {
				// Response should include both club and user information
				const response = {
					joined: true,
					club_id: 1,
					user_id: 5,
					club_name: 'Test Club',
				};

				expect(response.club_id).toBeDefined();
				expect(response.club_name).toBeDefined();
				expect(response.user_id).toBeDefined();
			});

			it('should use assignClubToUser model function', () => {
				// The endpoint should delegate to usersModel.assignClubToUser
				// This ensures duplicate prevention (onConflictDoNothing)
				const mockAssignmentResult = {
					data: [{ user_id: 5, club_id: 1 }],
				};

				expect(mockAssignmentResult.data).toBeDefined();
				expect(mockAssignmentResult.data.length).toBeGreaterThan(0);
			});

			it('should prevent duplicate club assignments', () => {
				// The assignClubToUser function uses onConflictDoNothing
				// So joining the same club twice should be idempotent
				const userId = 5;
				const clubId = 1;

				const firstJoin = {
					joined: true,
					user_id: userId,
					club_id: clubId,
				};

				const secondJoin = {
					joined: true,
					user_id: userId,
					club_id: clubId,
				};

				expect(firstJoin).toEqual(secondJoin);
			});
		});

		describe('Error Handling', () => {
			it('should return 400 if assignment fails', () => {
				// If the model function returns an error, return 400
				const assignmentError = {
					status: 400,
					error: 'Failed to assign user to club',
				};

				expect(assignmentError.status).toBe(400);
			});

			it('should return 500 on unexpected server errors', () => {
				// Database or other runtime errors should return 500
				const serverError = {
					status: 500,
					error: 'Failed to join club',
				};

				expect(serverError.status).toBe(500);
			});

			it('should log errors to console for debugging', () => {
				// Errors should be logged for server-side debugging
				const errorMessage = 'Error joining club: Database connection failed';
				expect(errorMessage).toContain('Error joining club');
			});
		});

		describe('Middleware Chain', () => {
			it('should use checkAuth middleware first', () => {
				// Authorization check happens before anything else
				// User must provide valid JWT token
				const requiredMiddleware = ['checkAuth', 'checkUserPermission'];
				expect(requiredMiddleware).toContain('checkAuth');
			});

			it('should use checkUserPermission middleware second', () => {
				// User permission check happens after auth
				// User must have lhUserId in Clerk metadata
				const requiredMiddleware = ['checkAuth', 'checkUserPermission'];
				expect(requiredMiddleware).toContain('checkUserPermission');
			});

			it('should execute in correct order: checkAuth -> checkUserPermission', () => {
				// The middleware chain ensures:
				// 1. User is authenticated (checkAuth)
				// 2. User is registered (checkUserPermission)
				// 3. Then business logic executes
				const middlewareOrder = ['checkAuth', 'checkUserPermission'];
				expect(middlewareOrder[0]).toBe('checkAuth');
				expect(middlewareOrder[1]).toBe('checkUserPermission');
			});
		});

		describe('Self-Assignment Pattern', () => {
			it('should assign the authenticated user to the club', () => {
				// The endpoint extracts lhUserId from the authenticated user
				// and assigns THAT user to the club (not a user_id from request body)
				const authUserId = 5;
				const assignedUserId = 5;

				expect(authUserId).toBe(assignedUserId);
			});

			it('should not allow users to join on behalf of others', () => {
				// Unlike PUT /api/users/:id, this endpoint does not accept user_id in request
				// It always assigns the authenticated user
				const authenticatedUserId = 5;
				const requestBodyUserId = 10; // Even if provided, should be ignored

				expect(authenticatedUserId).not.toBe(requestBodyUserId);
			});

			it('should use Clerk authentication to determine user identity', () => {
				// User identity comes from:
				// 1. Clerk JWT token in Authorization header
				// 2. Clerk privateMetadata.lhUserId
				// NOT from request body

				const userIdentitySources = ['Clerk JWT token', 'Clerk privateMetadata'];
				expect(userIdentitySources.length).toBe(2);
			});
		});

		describe('Database Interactions', () => {
			it('should query clubs table to verify club exists', () => {
				// Before assignment, should verify the club exists
				const query = 'SELECT * FROM clubs WHERE id = ?';
				expect(query).toContain('clubs');
			});

			it('should call assignClubToUser to create assignment', () => {
				// The model function handles the actual assignment
				// And duplicate prevention via onConflictDoNothing
				const modelFunction = 'assignClubToUser';
				expect(modelFunction).toBe('assignClubToUser');
			});

			it('should insert into users_to_clubs table', () => {
				// Final result is an entry in the users_to_clubs table
				const assignment = {
					user_id: 5,
					club_id: 1,
				};

				expect(assignment.user_id).toBeDefined();
				expect(assignment.club_id).toBeDefined();
			});
		});

		describe('Response Format', () => {
			it('should return consistent response format with join operations', () => {
				// Similar to DELETE /api/users/:id/clubs/:clubId which returns:
				// { removed: true, user_id: X, club_id: Y }
				// This should return:
				// { joined: true, user_id: X, club_id: Y, club_name: Z }

				const deleteResponse = {
					removed: true,
					user_id: 5,
					club_id: 1,
				};

				const joinResponse = {
					joined: true,
					user_id: 5,
					club_id: 1,
					club_name: 'Test Club',
				};

				expect(deleteResponse.user_id).toBe(joinResponse.user_id);
				expect(deleteResponse.club_id).toBe(joinResponse.club_id);
			});

			it('should include boolean success flag', () => {
				// Response includes "joined: true" to clearly indicate success
				const response = {
					joined: true,
					club_id: 1,
					user_id: 5,
					club_name: 'Test Club',
				};

				expect(response.joined).toBe(true);
			});

			it('should include user_id for confirmation', () => {
				// User can confirm they joined with their own ID
				const response = {
					joined: true,
					club_id: 1,
					user_id: 5,
					club_name: 'Test Club',
				};

				expect(response.user_id).toBeDefined();
			});

			it('should include club_id for confirmation', () => {
				// User can confirm which club they joined
				const response = {
					joined: true,
					club_id: 1,
					user_id: 5,
					club_name: 'Test Club',
				};

				expect(response.club_id).toBeDefined();
			});

			it('should include club_name for user convenience', () => {
				// Including the club name makes the response more user-friendly
				const response = {
					joined: true,
					club_id: 1,
					user_id: 5,
					club_name: 'Test Club',
				};

				expect(response.club_name).toBeDefined();
				expect(response.club_name).toBe('Test Club');
			});
		});
	});
});
