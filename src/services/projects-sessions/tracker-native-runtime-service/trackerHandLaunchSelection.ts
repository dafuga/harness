// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import {
	ladderFrom,
	parseTrackerModelSpec
} from '../../../utils/agents-providers/parseTrackerModelSpec';
import {
	canonicalNode,
	trackerFleetNodes
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { WatchdogPane } from '../WatchdogPaneService.types';

const explicitModel =
	/\b((?:gpt|claude)-[a-z0-9][a-z0-9._-]{0,72})(?:[: ](low|medium|high|xhigh|max|ultra))?\b/i;

export function handLaunchSelection(item: TrackerItem, node: string, pane?: WatchdogPane) {
	const spec = pane?.model ? modelSpec(pane.model, pane.effort) : handLaunchSpec(item, node, pane);
	if (!spec) return undefined;
	try {
		return parseTrackerModelSpec(spec, ladderFrom());
	} catch {
		return undefined;
	}
}

function handLaunchSpec(item: TrackerItem, node: string, pane?: WatchdogPane) {
	const launch = lastHandLaunch(item, pane);
	if (!launch) return item.model;
	if (handLaunchNode(item) !== node && canonicalNode(launch.node ?? '', {}) !== node)
		return item.model;
	const match = explicitModel.exec(launch.text);
	return match ? modelSpec(match[1], match[2]) : item.model;
}

function modelSpec(model: string, effort?: string) {
	return effort ? `${model}:${effort}` : model;
}

export function handLaunchNode(item: TrackerItem, after = 0): string | undefined {
	const launch = lastHandLaunch(item);
	const host =
		launch &&
		Date.parse(launch.at) >= after &&
		/\bon (?:the )?(daniel-primary-mbp|harbor-mbp-2|grok-box|primary(?: Mac)?|MB2|box)\b/i.exec(
			launch.text
		)?.[1];
	const node = host ? canonicalNode(/^primary/i.test(host) ? 'mac' : host, {}) : undefined;
	return node && trackerFleetNodes.includes(node) ? node : undefined;
}

function lastHandLaunch(item: TrackerItem, pane?: WatchdogPane) {
	return item.notes_log
		.filter(
			({ text, at }) =>
				/\b(?:hand|manually)[ -]launched\b/i.test(text) &&
				(!pane || (text.includes(pane.name) && Date.parse(at) >= pane.createdAt - 60_000))
		)
		.at(-1);
}
