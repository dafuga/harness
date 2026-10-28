import { clock } from '../utils/clock';

export class ClockService {
	run(value: string): string {
		return clock(value);
	}
}
