import type { Evidence } from '../../models/reports-media/Report.types';

export interface ReplayFrame {
	item: Evidence;
	scene: number | null;
	index: number;
	start: number;
	duration: number;
}
