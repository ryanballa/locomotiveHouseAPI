// Opening hours configuration
// TODO: Move to database-driven configuration in the future

export interface TimeSlot {
  hour: number;
  minute: number;
}

export interface DaySchedule {
  open: TimeSlot;
  close: TimeSlot;
  closed: boolean;
}

export type WeekSchedule = {
  [key in 0 | 1 | 2 | 3 | 4 | 5 | 6]: DaySchedule;
};

export const OPENING_HOURS: WeekSchedule = {
  0: { closed: true, open: { hour: 0, minute: 0 }, close: { hour: 0, minute: 0 } }, // Sunday - Closed
  1: { closed: false, open: { hour: 9, minute: 0 }, close: { hour: 21, minute: 30 } }, // Monday
  2: { closed: false, open: { hour: 9, minute: 0 }, close: { hour: 21, minute: 30 } }, // Tuesday
  3: { closed: false, open: { hour: 9, minute: 0 }, close: { hour: 21, minute: 30 } }, // Wednesday
  4: { closed: false, open: { hour: 9, minute: 0 }, close: { hour: 21, minute: 30 } }, // Thursday
  5: { closed: false, open: { hour: 9, minute: 0 }, close: { hour: 21, minute: 30 } }, // Friday
  6: { closed: false, open: { hour: 10, minute: 0 }, close: { hour: 16, minute: 30 } }, // Saturday
};

export const MIN_APPOINTMENT_DURATION = 30; // minutes
export const MAX_APPOINTMENT_DURATION = 480; // 8 hours in minutes
export const TIME_SLOT_INTERVAL = 30; // minutes

/**
 * Check if a given date/day is open
 */
export function isDateOpen(date: Date): boolean {
  const dayOfWeek = date.getDay() as keyof WeekSchedule;
  return !OPENING_HOURS[dayOfWeek].closed;
}

/**
 * Get opening hours for a specific date
 */
export function getOpeningHoursForDate(date: Date): DaySchedule {
  const dayOfWeek = date.getDay() as keyof WeekSchedule;
  return OPENING_HOURS[dayOfWeek];
}

/**
 * Convert 24-hour time to 12-hour format string
 */
export function formatTimeTo12Hour(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Convert 12-hour time string back to 24-hour format
 */
export function parse12HourTime(timeString: string): { hour: number; minute: number } {
  const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) {
    throw new Error('Invalid time format');
  }

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
}

/**
 * Generate time slots for a given date based on opening hours (in 12-hour format)
 */
export function generateTimeSlotsForDate(date: Date): string[] {
  const schedule = getOpeningHoursForDate(date);

  if (schedule.closed) {
    return [];
  }

  const slots: string[] = [];
  const { open, close } = schedule;

  let currentHour = open.hour;
  let currentMinute = open.minute;

  while (
    currentHour < close.hour ||
    (currentHour === close.hour && currentMinute <= close.minute)
  ) {
    const timeString = formatTimeTo12Hour(currentHour, currentMinute);
    slots.push(timeString);

    // Increment by TIME_SLOT_INTERVAL
    currentMinute += TIME_SLOT_INTERVAL;
    if (currentMinute >= 60) {
      currentHour += Math.floor(currentMinute / 60);
      currentMinute = currentMinute % 60;
    }
  }

  return slots;
}

/**
 * Format opening hours for display
 */
export function formatOpeningHours(date: Date): string {
  const schedule = getOpeningHoursForDate(date);

  if (schedule.closed) {
    return 'Closed';
  }

  const formatTime = (time: TimeSlot) => {
    const hour = time.hour > 12 ? time.hour - 12 : time.hour === 0 ? 12 : time.hour;
    const period = time.hour >= 12 ? 'PM' : 'AM';
    const minute = time.minute.toString().padStart(2, '0');
    return `${hour}:${minute} ${period}`;
  };

  return `${formatTime(schedule.open)} - ${formatTime(schedule.close)}`;
}

/**
 * Get day name from date
 */
export function getDayName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}
