// @harness-uid u_dv4lnm54rz
export interface CronField {
	readonly name: string;
	readonly min: number;
	readonly max: number;
	readonly names?: readonly string[];
}

export interface CronSchedule {
	minutes: Set<number>;
	hours: Set<number>;
	daysOfMonth: Set<number>;
	months: Set<number>;
	daysOfWeek: Set<number>;
	anyDayOfMonth: boolean;
	anyDayOfWeek: boolean;
}

export interface CronTimeCache {
	times: readonly number[];
	formatter: Intl.DateTimeFormat;
	cache: Map<number, Map<number, number>>;
}
