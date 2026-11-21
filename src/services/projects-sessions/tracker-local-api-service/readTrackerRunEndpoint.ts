// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import {
	classifyTrackerTask,
	projectOf
} from '../../../utils/agents-providers/classifyTrackerTask';
import { ladderFrom } from '../../../utils/agents-providers/parseTrackerModelSpec';
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import { pickTrackerModel } from '../../../utils/agents-providers/pickTrackerModel';
import {
	trackerModelHistory,
	trackerRunReport
} from '../../../utils/agents-providers/trackerRunReport';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';

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
				limit: query.limit
			});
		case 'models':
			if (parts[1] === 'report') {
				return {
					ladder: ladderFrom(ladderConfig).map(({ id }) => id),
					rows: trackerRunReport(runs.finished())
				};
			}
			return undefined;
		case 'items':
			if (parts.length === 3 && parts[2] === 'pick') {
				return itemPick(items.get(parts[1]), runs, ladderConfig);
			}
			return undefined;
		default:
			return undefined;
	}
}

function itemPick(item: TrackerItem, runs: TrackerRunReadRepository, cfg?: TrackerLadderConfig) {
	const history = trackerModelHistory(
		runs.finished(),
		{ kind: classifyTrackerTask(item), project: projectOf(item) },
		cfg?.autolaunch?.learning?.minSamples
	);
	const { rung, kind, reason } = pickTrackerModel(item, { cfg, history });
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
