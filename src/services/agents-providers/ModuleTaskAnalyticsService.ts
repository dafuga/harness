import type { AnalyticsEvent } from '../../core/reports-media/analyticsTypes';
import type { TaskUsage } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { AnalyticsRepository } from '../../repositories/reports-media/AnalyticsRepository';
import { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import { projectIdentity } from '../../workflows/reports-media/analyticsRecord';
import { taskEvents } from './module-task-analytics-service/taskEvents';
import { taskMetrics } from './module-task-analytics-service/taskMetrics';
import { taskApiCost } from './module-task-analytics-service/taskPricing';
import type { TaskAnalyticsStore } from './ModuleTaskAnalyticsService.types';
/** Price task attempts and reconcile committed submissions/reviews into existing analytics. */
export class ModuleTaskAnalyticsService {
	constructor(private readonly store: () => TaskAnalyticsStore = () => new AnalyticsRepository()) {}
	quote(model: string, usage?: TaskUsage) {
		return taskApiCost(model, usage);
	}
	metrics(events: AnalyticsEvent[]) {
		return taskMetrics(events);
	}
	async sync(root: string): Promise<number> {
		if (process.env.HARNESS_ANALYTICS_DISABLED === '1') return 0;
		try {
			const queue = await new ModuleTaskRepository(root).read();
			if (!queue.data.tasks.length) return 0;
			const events = taskEvents(queue.data.tasks, await projectIdentity(root));
			const repository = this.store();
			try {
				for (const event of events) repository.recordImported(event);
			} finally {
				repository.close();
			}
			return events.length;
		} catch {
			console.error('Warning: Harness module task analytics could not be recorded.');
			return 0;
		}
	}
}
