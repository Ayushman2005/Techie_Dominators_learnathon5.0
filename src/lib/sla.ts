/**
 * SLA (Service Level Agreement) utilities for grievance response-time tracking.
 *
 * SLA windows are defined per-priority and computed purely from the grievance's
 * `createdAt` timestamp + priority — no DB schema changes are required.
 *
 * Windows:
 *  - urgent  → 24 h
 *  - high    → 72 h  (3 days)
 *  - medium  → 120 h (5 days)
 *  - low     → 168 h (7 days)
 */

export type SlaVariant = 'resolved' | 'on-track' | 'at-risk' | 'overdue';

export interface SlaStatus {
	/** Human-readable label e.g. "Due in 2d 3h" or "Overdue by 1d" */
	label: string;
	/** UI colour variant */
	variant: SlaVariant;
	/** Whether the SLA deadline has passed */
	overdue: boolean;
	/** Hours remaining (negative if overdue) */
	hoursRemaining: number;
	/** The ISO deadline string */
	deadlineIso: string;
}

/** Hours allowed per priority level. */
const SLA_HOURS: Record<string, number> = {
	urgent: 24,
	high: 72,
	medium: 120,
	low: 168
};

/**
 * Returns the ISO deadline string for a given priority + creation timestamp.
 */
export function getSlaDeadline(priority: string, createdAt: string): string {
	const hours = SLA_HOURS[priority] ?? SLA_HOURS.medium;
	const created = new Date(createdAt).getTime();
	return new Date(created + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Formats a duration in hours into a compact human-readable string.
 * e.g. 26.5 → "1d 2h", 1.75 → "1h 45m", -3 → "3h"
 */
function formatDuration(absHours: number): string {
	const days = Math.floor(absHours / 24);
	const hours = Math.floor(absHours % 24);
	const minutes = Math.round((absHours - Math.floor(absHours)) * 60);

	if (days > 0 && hours > 0) return `${days}d ${hours}h`;
	if (days > 0) return `${days}d`;
	if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
	if (hours > 0) return `${hours}h`;
	return `${Math.max(1, minutes)}m`;
}

/**
 * Computes the full SLA status for a grievance.
 *
 * @param priority - The grievance priority ('urgent' | 'high' | 'medium' | 'low')
 * @param createdAt - ISO creation timestamp
 * @param status - UI status string ('Open' | 'In Progress' | 'Resolved')
 * @param now - Optional override for "now" (used in tests)
 */
export function getSlaStatus(
	priority: string,
	createdAt: string,
	status: string,
	now: Date = new Date()
): SlaStatus {
	// Resolved grievances always show a green "Resolved" badge — no countdown needed
	if (status === 'Resolved') {
		return {
			label: 'Resolved',
			variant: 'resolved',
			overdue: false,
			hoursRemaining: 0,
			deadlineIso: getSlaDeadline(priority, createdAt)
		};
	}

	const deadlineIso = getSlaDeadline(priority, createdAt);
	const deadlineMs = new Date(deadlineIso).getTime();
	const nowMs = now.getTime();
	const diffMs = deadlineMs - nowMs;
	const hoursRemaining = diffMs / (1000 * 60 * 60);
	const overdue = hoursRemaining < 0;

	let label: string;
	let variant: SlaVariant;

	if (overdue) {
		label = `Overdue by ${formatDuration(Math.abs(hoursRemaining))}`;
		variant = 'overdue';
	} else {
		label = `Due in ${formatDuration(hoursRemaining)}`;
		// At-risk: less than 25% of SLA window remaining
		const totalHours = SLA_HOURS[priority] ?? SLA_HOURS.medium;
		const pctRemaining = hoursRemaining / totalHours;
		variant = pctRemaining <= 0.25 ? 'at-risk' : 'on-track';
	}

	return { label, variant, overdue, hoursRemaining, deadlineIso };
}
