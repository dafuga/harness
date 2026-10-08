export function analyticsDisplay(value: number | null): string {
	return value === null ? 'No assessments' : `${Math.round(value * 100)}%`;
}
export function analyticsCount(value: number): string {
	return value.toLocaleString();
}
