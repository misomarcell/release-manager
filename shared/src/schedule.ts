export const SCHEDULE_HOUR_STEPS = [1, 2, 3, 4, 6, 8, 12];

/** Weekdays in display order; `day` is the cron number (0 is Sunday). */
export const WEEKDAYS = [
    { day: 1, short: 'Mon', name: 'Monday' },
    { day: 2, short: 'Tue', name: 'Tuesday' },
    { day: 3, short: 'Wed', name: 'Wednesday' },
    { day: 4, short: 'Thu', name: 'Thursday' },
    { day: 5, short: 'Fri', name: 'Friday' },
    { day: 6, short: 'Sat', name: 'Saturday' },
    { day: 0, short: 'Sun', name: 'Sunday' },
];

const ALL_DAYS = WEEKDAYS.map((weekday) => weekday.day);
const WORKDAYS = '1,2,3,4,5';

export type Schedule =
    | { kind: 'days'; days: number[]; time: string }
    | { kind: 'hours'; every: number }
    | { kind: 'custom'; cron: string };

export const DEFAULT_SCHEDULE = { kind: 'days', days: ALL_DAYS, time: '06:00' } satisfies Schedule;

export function scheduleToCron(schedule: Schedule): string {
    if (schedule.kind === 'custom') return schedule.cron;
    if (schedule.kind === 'hours') return schedule.every === 1 ? '0 * * * *' : `0 */${schedule.every} * * *`;

    const [hour, minute] = schedule.time.split(':').map(Number);
    const days = sortedDays(schedule.days);
    return `${minute} ${hour} * * ${days.length === ALL_DAYS.length ? '*' : days.join(',')}`;
}

export function cronToSchedule(cron: string): Schedule {
    const [minute, hour, dayOfMonth, month, dayOfWeek, ...rest] = cron.trim().split(/\s+/);
    const custom: Schedule = { kind: 'custom', cron: cron.trim() };
    if (rest.length > 0 || dayOfMonth !== '*' || month !== '*') return custom;

    const every = parseHourStep(minute, hour);
    if (every && dayOfWeek === '*') return { kind: 'hours', every };

    const days = parseDays(dayOfWeek);
    if (!days || !isNumberUpTo(minute, 59) || !isNumberUpTo(hour, 23)) return custom;
    return { kind: 'days', days, time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` };
}

export function describeSchedule(schedule: Schedule): string {
    if (schedule.kind === 'custom') return `Custom schedule (${schedule.cron})`;
    if (schedule.kind === 'hours') return schedule.every === 1 ? 'Every hour' : `Every ${schedule.every} hours`;
    return `${describeDays(schedule.days)} at ${schedule.time}`;
}

function describeDays(days: number[]): string {
    if (days.length === ALL_DAYS.length) return 'Every day';
    if (sortedDays(days).join(',') === WORKDAYS) return 'Weekdays';
    return WEEKDAYS.filter((weekday) => days.includes(weekday.day))
        .map((weekday) => weekday.short)
        .join(', ');
}

function sortedDays(days: number[]): number[] {
    return [...new Set(days)].sort((a, b) => a - b);
}

function isNumberUpTo(value: string | undefined, max: number): value is string {
    return value !== undefined && /^\d{1,2}$/.test(value) && Number(value) <= max;
}

function parseHourStep(minute: string | undefined, hour: string | undefined): number | null {
    if (minute !== '0' || !hour) return null;
    const every = hour === '*' ? 1 : Number(/^\*\/(\d+)$/.exec(hour)?.[1]);
    return SCHEDULE_HOUR_STEPS.includes(every) ? every : null;
}

function parseDays(dayOfWeek: string | undefined): number[] | null {
    if (dayOfWeek === '*') return [...ALL_DAYS];
    if (!dayOfWeek || !/^[0-7](,[0-7])*$/.test(dayOfWeek)) return null;
    return sortedDays(dayOfWeek.split(',').map((day) => Number(day) % 7));
}
