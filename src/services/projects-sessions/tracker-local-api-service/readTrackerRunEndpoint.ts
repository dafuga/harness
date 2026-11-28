// @harness-uid u_g7kdpz7bel
import { describeTrackerScheduleHold } from '../../../utils/projects-sessions/trackerScheduleHold';
import { trackerRunCost } from '../../agents-providers/module-task-analytics-service/trackerRunRecords';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import { ladderFrom } from '../../../utils/agents-providers/parseTrackerModelSpec';
import type { TrackerRetryOptions } from '../../../utils/agents-providers/pickTrackerModel.types';
import { pickTrackerModelFromRuns } from '../../../utils/agents-providers/pickTrackerModelFromRuns';
import { trackerRunReport } from '../../../utils/agents-providers/trackerRunReport';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';

export function readTrackerItemDetail(item: TrackerItem, options: TrackerLocalApiOptions) {
	const runs = options.runs?.list({ itemId: item.id }) ?? [];
	const launch = itemLaunchStatus(item, runs, options);
	return {
		...item,
		...(item.auto || runs.length ? { runs, launch_status: launch } : {}),
		schedule_preview: readSchedulePreview(item, options, launch)
	};
}

function readSchedulePreview(
	item: TrackerItem,
	options: TrackerLocalApiOptions,
	launch: ReturnType<typeof itemLaunchStatus>
) {
	if (item.schedule_hold) return describeTrackerScheduleHold(item.schedule_hold);
	if (item.launch_source === 'due' && launch) return launch.reason;
	return options.schedulePreview?.(item) ?? item.schedule_status;
}

function itemLaunchStatus(
	item: TrackerItem,
	runs: TrackerListedRun[],
	{ launchWait }: TrackerLocalApiOptions
) {
	if (!item.auto) return null;
	const matching = runs.filter((run) => run.auto_token === item.auto).reverse();
	const current =
		matching.find((run) => run.state === 'queued') ?? matching.find((run) => run.started_at);
	if (!current) return launchWait?.(item) ?? null;
	const computer = item.launch_target ?? current.node ?? item.computer;
	return { computer, reason: current.outcome ?? current.state, attempt: current.attempt };
}

export function readTrackerRunEndpoint(
	parts: string[],
	query: Record<string, string>,
	options: TrackerLocalApiOptions & { items: TrackerItemReadRepository }
) {
	const { items, runs, ladderConfig } = options;
	if (!runs) return undefined;
	switch (parts[0]) {
		case 'runs':
			return runs.list({
				itemId: query.item ? items.resolve(query.item).id : undefined,
				limit: query.limit,
				includeActive: query.include_active === '1'
			});
		case 'models':
			if (parts[1] === 'report') {
				return {
					ladder: ladderFrom(ladderConfig).map(({ id }) => id),
					rows: trackerRunReport(runs.finished(), trackerRunCost)
				};
			}
			return undefined;
		case 'items':
			if (parts.length === 3 && parts[2] === 'pick') {
				return itemPick(items.get(parts[1]), runs, {
					cfg: ladderConfig,
					claudePreferredUntil: options.claudePreferredUntil?.()
				});
			}
			return undefined;
		default:
			return undefined;
	}
}

function itemPick(
	item: TrackerItem,
	runs: TrackerRunReadRepository,
	selection: TrackerRetryOptions
) {
	const { rung, kind, reason } = pickTrackerModelFromRuns(item, () => runs.finished(), selection);
	return {
		item_id: item.id,
		rung: rung.id,
		model: rung.model,
		cli: rung.cli,
		effort: rung.effort,
		kind,
		pinned: Boolean(rung.pinned),
		reason,
		auto: Boolean(item.auto),
		computer: item.computer
	};
}
