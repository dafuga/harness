import { classifyTrackerTask, projectOf } from './classifyTrackerTask';
import type { TrackerModelItem } from './classifyTrackerTask.types';
import type { TrackerLadderConfig } from './parseTrackerModelSpec.types';
import { pickTrackerModel } from './pickTrackerModel';
import { trackerModelHistory } from './trackerRunReport';
import type { TrackerRunRow } from './trackerRunReport.types';

/** Pick a model with learning from finished runs on similar tasks. Pins ignore history. */
export function pickTrackerModelFromRuns(
	item: TrackerModelItem,
	finished: () => readonly TrackerRunRow[],
	{ cfg, now }: { cfg?: TrackerLadderConfig; now?: number } = {}
) {
	const history = item.model
		? undefined
		: trackerModelHistory(
				finished(),
				{ kind: classifyTrackerTask(item), project: projectOf(item) },
				cfg?.autolaunch?.learning?.minSamples
			);
	return pickTrackerModel(item, { cfg, history, now });
}
