// @harness-uid u_yz3ar5ts6w
import type { StartupPlan, StartupScan } from './WatchdogStartupService.types';

export class WatchdogStartupService {
	plan(_input: StartupScan): StartupPlan {
		return { actions: [], clearAlerts: [] };
	}
}
