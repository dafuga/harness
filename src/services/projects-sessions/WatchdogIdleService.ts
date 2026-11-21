// @harness-uid u_3jxqtek5x2
import type { IdlePlan, IdleScan } from './WatchdogIdleService.types';

export class WatchdogIdleService {
	plan(_input: IdleScan): IdlePlan {
		return { actions: [], abandonRunIds: [] };
	}
}
