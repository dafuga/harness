import type { Report } from '../../models/reports-media/Report.types';

declare global {
	interface Window {
		projectReport: Report;
	}
}
export {};
