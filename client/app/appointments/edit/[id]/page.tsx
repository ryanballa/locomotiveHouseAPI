'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import {
	generateTimeSlotsForDate,
	formatOpeningHours,
	getDayName,
	isDateOpen,
	formatTimeTo12Hour,
	parse12HourTime,
	MIN_APPOINTMENT_DURATION,
	MAX_APPOINTMENT_DURATION,
} from '@/lib/openingHours';

export default function EditAppointment() {
	const { getToken } = useAuth();
	const { user } = useUser();
	const router = useRouter();
	const params = useParams();
	const appointmentId = parseInt(params.id as string);

	const [formData, setFormData] = useState({
		date: '',
		time: '',
		duration: MIN_APPOINTMENT_DURATION,
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

	// Load existing appointment
	useEffect(() => {
		const fetchAppointment = async () => {
			try {
				setLoading(true);
				const token = await getToken();
				const appointments = await apiClient.getAppointments(token || undefined);
				const appointment = appointments.find((a) => a.id === appointmentId);

				if (!appointment) {
					setError('Appointment not found');
					return;
				}

				const scheduleDate = new Date(appointment.schedule);

				// Extract date in local timezone
				const year = scheduleDate.getFullYear();
				const month = (scheduleDate.getMonth() + 1).toString().padStart(2, '0');
				const day = scheduleDate.getDate().toString().padStart(2, '0');
				const dateString = `${year}-${month}-${day}`;

				// Extract time in 12-hour format from local time
				const hours = scheduleDate.getHours();
				const minutes = scheduleDate.getMinutes();
				const timeString = formatTimeTo12Hour(hours, minutes);

				setFormData({
					date: dateString,
					time: timeString,
					duration: appointment.duration,
				});

				// Generate time slots for the loaded date
				const selectedDate = new Date(dateString + 'T00:00:00');
				if (isDateOpen(selectedDate)) {
					const slots = generateTimeSlotsForDate(selectedDate);
					// Ensure the current time is in the available slots
					if (!slots.includes(timeString)) {
						setAvailableTimeSlots([...slots, timeString].sort());
					} else {
						setAvailableTimeSlots(slots);
					}
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load appointment');
			} finally {
				setLoading(false);
			}
		};

		if (user) {
			fetchAppointment();
		}
	}, [user, getToken, appointmentId]);

	// Update available time slots when date changes
	useEffect(() => {
		if (formData.date && !loading) {
			const selectedDate = new Date(formData.date + 'T00:00:00');
			if (!isDateOpen(selectedDate)) {
				setAvailableTimeSlots([]);
				setError(`${getDayName(selectedDate)} is closed`);
			} else {
				setError(null);
				const slots = generateTimeSlotsForDate(selectedDate);
				setAvailableTimeSlots(slots);
			}
		} else if (!formData.date) {
			setAvailableTimeSlots([]);
		}
	}, [formData.date, loading]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!formData.date || !formData.time) {
			setError('Please select both date and time');
			return;
		}

		try {
			setSaving(true);
			const token = await getToken();

			if (!token) {
				setError('Authentication required');
				return;
			}

			// Combine date and time into ISO string
			// Parse the date and time components
			const [year, month, day] = formData.date.split('-').map(Number);
			const { hour, minute } = parse12HourTime(formData.time);

			// Create date in local timezone
			const scheduleDateTime = new Date(year, month - 1, day, hour, minute);

			const appointmentData = {
				schedule: scheduleDateTime.toISOString(),
				duration: formData.duration,
			};

			const result = await apiClient.updateAppointment(appointmentId, appointmentData, token);

			if (result.updated) {
				router.push('/');
			} else {
				setError('Failed to update appointment');
			}
		} catch (err) {
			console.error('Error caught in handleSubmit:', err);
			setError(err instanceof Error ? err.message : 'Failed to update appointment');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50">
				<Navbar />
				<main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div className="flex justify-center items-center py-12">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
					</div>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<Navbar />

			<main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 mb-2">Edit Appointment</h1>
					<p className="text-gray-600">Update your appointment details</p>
				</div>

				<div className="bg-white rounded-lg shadow-md p-6">
					{error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
								Select Date
							</label>
							<input
								type="date"
								id="date"
								value={formData.date}
								onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
								min={new Date().toISOString().split('T')[0]}
								className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								required
							/>
							{formData.date && (
								<p className="mt-2 text-sm text-gray-600">
									{getDayName(new Date(formData.date + 'T00:00:00'))}: {formatOpeningHours(new Date(formData.date + 'T00:00:00'))}
								</p>
							)}
						</div>

						<div>
							<label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
								Select Time
							</label>
							<select
								id="time"
								value={formData.time}
								onChange={(e) => setFormData({ ...formData, time: e.target.value })}
								className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
								required
								disabled={!formData.date || availableTimeSlots.length === 0}
							>
								<option value="">Choose a time slot</option>
								{availableTimeSlots.map((slot) => (
									<option key={slot} value={slot}>
										{slot}
									</option>
								))}
							</select>
							{formData.date && availableTimeSlots.length === 0 && (
								<p className="mt-2 text-sm text-red-600">No available time slots for this date</p>
							)}
						</div>

						<div>
							<label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
								Duration: {formData.duration} minutes ({(formData.duration / 60).toFixed(1)} hours)
							</label>
							<input
								type="range"
								id="duration"
								min={MIN_APPOINTMENT_DURATION}
								max={MAX_APPOINTMENT_DURATION}
								step={30}
								value={formData.duration}
								onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
								className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
							/>
							<div className="flex justify-between text-xs text-gray-500 mt-1">
								<span>{MIN_APPOINTMENT_DURATION} min</span>
								<span>{MAX_APPOINTMENT_DURATION} min</span>
							</div>
						</div>

						<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
							<h3 className="text-sm font-medium text-blue-900 mb-1">Appointment Details</h3>
							<ul className="text-sm text-blue-700 space-y-1">
								<li>
									Duration: {formData.duration} minutes ({(formData.duration / 60).toFixed(1)} hours)
								</li>
								<li>User: {user?.firstName || user?.emailAddresses[0]?.emailAddress}</li>
								{formData.date && formData.time && (
									<li>
										Scheduled: {new Date(formData.date + 'T' + formData.time).toLocaleDateString()} at {formData.time}
									</li>
								)}
							</ul>
						</div>

						<div className="flex gap-4">
							<button
								type="submit"
								disabled={saving}
								className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
							>
								{saving ? 'Updating...' : 'Update Appointment'}
							</button>
							<button
								type="button"
								onClick={() => router.push('/')}
								className="px-6 py-3 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			</main>
		</div>
	);
}
