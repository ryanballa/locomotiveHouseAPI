/**
 * API Type Definitions
 *
 * This file exports TypeScript types for all API entities.
 * These types are auto-generated from your models and can be used
 * in frontend applications for type-safe API calls.
 */

// Users
export interface User {
	id: number;
	token: string;
	first_name?: string;
	last_name?: string;
	permission: number;
}

// Permissions
export interface Permission {
	id: number;
	title: string;
}

// Clubs
export interface Club {
	id: number;
	name: string;
}

// Addresses
export interface Address {
	id: number;
	number: number;
	description: string;
	in_use: boolean;
	user_id: number;
	club_id: number;
}

// Consists
export interface Consist {
	id: number;
	number: number;
	in_use: boolean;
	user_id: number;
}

// Appointments
export interface Appointment {
	id: number;
	schedule: Date | string;
	duration: number;
	user_id: number;
	scheduled_session_id?: number | null;
}

// Scheduled Sessions
export interface ScheduledSession {
	id: number;
	schedule: Date | string;
	club_id: number;
	description?: string;
}

// Towers
export interface Tower {
	id: number;
	name: string;
	club_id: number;
	description?: string;
	owner_id: number;
	created_at: Date | string;
	updated_at: Date | string;
}

// Tower Reports
export interface TowerReport {
	id: number;
	tower_id: number;
	user_id: number;
	description?: string;
	report_at: Date | string;
	created_at: Date | string;
	updated_at: Date | string;
}

// Issues
export interface Issue {
	id: number;
	tower_id: number;
	user_id: number;
	title: string;
	type: string;
	status: string;
	description?: string;
	created_at: Date | string;
	updated_at: Date | string;
}

// Email Queue
export interface EmailQueueItem {
	id: number;
	recipient_email: string;
	subject: string;
	body: string;
	html_body?: string;
	status: 'pending' | 'sent' | 'failed';
	retry_count: number;
	max_retries: number;
	last_error?: string;
	scheduled_at?: Date | string;
	sent_at?: Date | string;
	created_at: Date | string;
	updated_at: Date | string;
}

// Invite Tokens
export interface InviteToken {
	id: number;
	token: string;
	club_id: number;
	role_permission?: number;
	expires_at: Date | string;
	created_at: Date | string;
}

// Notices
export interface Notice {
	id: number;
	club_id: number;
	description: string;
	type?: string | null;
	expires_at?: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
}

// API Response Types
export interface ApiResponse<T> {
	error?: string | any;
	data?: T;
	result?: T;
}

export interface ApiListResponse<T> {
	error?: string | any;
	result?: T[];
	data?: T[];
	appointments?: T[];
	addresses?: T[];
	tokens?: T[];
}
