'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiClient, type Appointment, type User } from '@/lib/api';
import { Navbar } from '@/components/navbar';

interface GroupedAppointments {
	[date: string]: Appointment[];
}

interface UserMap {
	[userId: number]: string;
}

export default function Home() {
	const { getToken } = useAuth();
	const router = useRouter();
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [users, setUsers] = useState<User[]>([]);
	const [clerkUsers, setClerkUsers] = useState<UserMap>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [currentUserLhId, setCurrentUserLhId] = useState<number | null>(null);
	const [creatingFriday, setCreatingFriday] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				const token = await getToken();

				// Fetch current user's lhUserId and other data in parallel
				const [appointmentsData, usersData, userIdResponse] = await Promise.all([
					apiClient.getAppointments(token || undefined),
					apiClient.getUsers(token || ''),
					fetch('/api/user-id'),
				]);

				const userIdData = await userIdResponse.json();
				if (userIdData.lhUserId) {
					setCurrentUserLhId(userIdData.lhUserId);
				}

				setAppointments(appointmentsData);
				setUsers(usersData);

				// Fetch Clerk user details for each user
				const userMap: UserMap = {};
				const clerkUserPromises = usersData.map(async (user) => {
					try {
						const response = await fetch(`/api/clerk-user/${user.token}`);
						const data = await response.json();
						if (data.name) {
							userMap[user.id] = data.name;
						}
					} catch (err) {
						console.error(`Failed to fetch Clerk user for ${user.token}`, err);
					}
				});

				await Promise.all(clerkUserPromises);
				setClerkUsers(userMap);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load data');
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [getToken]);

	const groupedAppointments = useMemo(() => {
		const grouped: GroupedAppointments = {};

		appointments.forEach((appointment) => {
			const date = new Date(appointment.schedule);
			const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

			if (!grouped[dateKey]) {
				grouped[dateKey] = [];
			}
			grouped[dateKey].push(appointment);
		});

		// Sort appointments within each day by time
		Object.keys(grouped).forEach((dateKey) => {
			grouped[dateKey].sort((a, b) => new Date(a.schedule).getTime() - new Date(b.schedule).getTime());
		});

		return grouped;
	}, [appointments]);

	const sortedDates = useMemo(() => {
		return Object.keys(groupedAppointments).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
	}, [groupedAppointments]);

	// Get next 4 Fridays
	const nextFridays = useMemo(() => {
		const fridays: string[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		let current = new Date(today);
		// Move to next Friday
		const daysUntilFriday = (5 - current.getDay() + 7) % 7;
		current.setDate(current.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));

		for (let i = 0; i < 4; i++) {
			const year = current.getFullYear();
			const month = (current.getMonth() + 1).toString().padStart(2, '0');
			const day = current.getDate().toString().padStart(2, '0');
			fridays.push(`${year}-${month}-${day}`);
			current.setDate(current.getDate() + 7);
		}

		return fridays;
	}, []);

	// Check evening appointments for each Friday
	const fridayEveningStats = useMemo(() => {
		const stats: { [date: string]: { count: number; needsSignup: boolean; userHasAppointment: boolean } } = {};

		nextFridays.forEach((friday) => {
			const appointmentsForDay = groupedAppointments[friday] || [];
			const eveningAppointments = appointmentsForDay.filter((apt) => {
				const date = new Date(apt.schedule);
				const hour = date.getHours();
				return hour >= 17; // 5 PM or later
			});

			// Check if current user already has an evening appointment on this Friday
			const userHasAppointment = eveningAppointments.some((apt) => apt.user_id === currentUserLhId);

			stats[friday] = {
				count: eveningAppointments.length,
				needsSignup: eveningAppointments.length < 2,
				userHasAppointment,
			};
		});

		return stats;
	}, [nextFridays, groupedAppointments, currentUserLhId]);

	const formatDayHeader = (dateString: string) => {
		const date = new Date(dateString + 'T00:00:00');
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}).format(date);
	};

	const formatTime = (dateString: string) => {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('en-US', {
			timeStyle: 'short',
		}).format(date);
	};

	const handleDelete = async (id: number) => {
		if (!confirm('Are you sure you want to delete this appointment?')) {
			return;
		}

		try {
			setDeletingId(id);
			const token = await getToken();
			if (!token) {
				setError('Authentication required');
				return;
			}

			const result = await apiClient.deleteAppointment(id, token);
			if (result.deleted) {
				// Remove from local state
				setAppointments(appointments.filter((a) => a.id !== id));
			} else {
				setError('Failed to delete appointment');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to update appointment');
		} finally {
			setDeletingId(null);
		}
	};

	const handleFridaySignup = async (dateString: string) => {
		if (!currentUserLhId) {
			setError('You must be logged in to create an appointment');
			return;
		}

		try {
			setCreatingFriday(dateString);
			const token = await getToken();
			if (!token) {
				setError('Authentication required');
				return;
			}

			// Create appointment at 5 PM on the selected Friday
			const [year, month, day] = dateString.split('-').map(Number);
			const appointmentDate = new Date(year, month - 1, day, 17, 0); // 5:00 PM

			const appointmentData = {
				schedule: appointmentDate.toISOString(),
				duration: 60,
				user_id: currentUserLhId,
			};

			const result = await apiClient.createAppointment(appointmentData, token);
			if (result.created) {
				// Refresh appointments
				const appointmentsData = await apiClient.getAppointments(token);
				setAppointments(appointmentsData);
			} else {
				setError('Failed to create appointment');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to create appointment');
		} finally {
			setCreatingFriday(null);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<Navbar />

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 mb-2">Appointments</h1>
					<p className="text-gray-600">View all scheduled appointments</p>
				</div>

				{loading && (
					<div className="flex justify-center items-center py-12">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
					</div>
				)}

				{error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

				{/* Friday Evening Sessions */}
				{!loading && (
					<div className="mb-12">
						<h2 className="text-3xl font-bold text-gray-900 mb-6">Friday Evening Sessions</h2>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							{nextFridays.map((friday) => {
								const stats = fridayEveningStats[friday];
								return (
									<div
										key={friday}
										className={`bg-white rounded-lg shadow-md p-6 border-2 ${
											stats.needsSignup ? 'border-orange-400' : 'border-green-400'
										}`}
									>
										<h3 className="text-lg font-bold text-gray-900 mb-2">{formatDayHeader(friday)}</h3>
										<div className="mb-4">
											<p className="text-sm text-gray-600">
												Evening appointments (after 5 PM): <span className="font-semibold">{stats.count}</span>
											</p>
										</div>
										{stats.userHasAppointment ? (
											<div className="flex items-center text-blue-700">
												<svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
													<path
														fillRule="evenodd"
														d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
														clipRule="evenodd"
													/>
												</svg>
												<span className="text-sm font-medium">You're signed up!</span>
											</div>
										) : stats.needsSignup ? (
											<div className="space-y-2">
												<p className="text-sm text-orange-700 font-medium">Need more signups!</p>
												<button
													onClick={() => handleFridaySignup(friday)}
													disabled={creatingFriday === friday}
													className="w-full px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													{creatingFriday === friday ? 'Creating...' : 'Sign up for 5 PM'}
												</button>
											</div>
										) : (
											<div className="flex items-center text-green-700">
												<svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
													<path
														fillRule="evenodd"
														d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
														clipRule="evenodd"
													/>
												</svg>
												<span className="text-sm font-medium">Good turnout!</span>
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}

				{!loading && !error && appointments.length === 0 && (
					<div className="bg-white rounded-lg shadow-md p-8 text-center">
						<p className="text-gray-500 text-lg">No appointments scheduled yet.</p>
					</div>
				)}

				{!loading && !error && appointments.length > 0 && (
					<div className="space-y-8">
						{sortedDates.map((dateKey) => (
							<div key={dateKey}>
								<div className="mb-4">
									<h2 className="text-2xl font-bold text-gray-900 border-b-2 border-blue-600 pb-2">{formatDayHeader(dateKey)}</h2>
									<p className="text-sm text-gray-500 mt-1">
										{groupedAppointments[dateKey].length} appointment{groupedAppointments[dateKey].length !== 1 ? 's' : ''}
									</p>
								</div>
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									{groupedAppointments[dateKey].map((appointment) => (
										<div key={appointment.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
											<div className="flex items-start justify-between mb-4">
												<div className="flex-1">
													<div className="flex items-center gap-2 mb-2">
														<span className="text-2xl font-bold text-blue-600">{formatTime(appointment.schedule)}</span>
													</div>
													<p className="text-sm text-gray-600">Appointment #{appointment.id}</p>
												</div>
												<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
													{appointment.duration} min
												</span>
											</div>
											<div className="border-t pt-4">
												<p className="text-sm text-gray-500 mb-3">
													{clerkUsers[appointment.user_id]
														? `Club Member: ${clerkUsers[appointment.user_id]}`
														: `User ID: ${appointment.user_id}`}
												</p>
												{currentUserLhId === appointment.user_id && (
													<div className="flex gap-2">
														<button
															onClick={() => router.push(`/appointments/edit/${appointment.id}`)}
															className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
														>
															Edit
														</button>
														<button
															onClick={() => handleDelete(appointment.id)}
															disabled={deletingId === appointment.id}
															className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
														>
															{deletingId === appointment.id ? 'Deleting...' : 'Delete'}
														</button>
													</div>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
