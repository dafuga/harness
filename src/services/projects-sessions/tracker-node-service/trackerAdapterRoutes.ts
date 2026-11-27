// @harness-uid u_gvqtr5mdwv
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { isTrackerAdapterSourceId } from '../../../repositories/projects-sessions/TrackerAdapterSourceRepository';
import type { TrackerAdapterSourceAction } from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import {
	ladderFrom,
	parseTrackerModelSpec
} from '../../../utils/agents-providers/parseTrackerModelSpec';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerAdapterPollService } from '../TrackerAdapterPollService';
import {
	addTrackerAdapterSource,
	changeTrackerAdapterSource
} from '../tracker-adapter-poll-service/manageTrackerAdapterSource';
import { trackerMessageSourceInput } from '../tracker-adapter-poll-service/trackerMessageSourceInput';
import { trackerAdapterSourceInput } from '../tracker-adapter-poll-service/trackerAdapterSourceInput';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import { readItemBody } from '../tracker-local-api-service/trackerLocalItemMutation';

const elsewhere = 'Run adapters on the designated Tracker runner';
/** GitHub reads can outlast the listener's idle timeout. */
export const trackerSlowAdapterPath: RegExp = /\/adapters\/(?:run|add)$/;

export function trackerAdapterRoute(
	request: Request,
	runtime: TrackerNativeRuntimeService
): Promise<Response> | undefined {
	const url = new URL(request.url);
	const action = /^\/adapters\/(run|add|pause|resume|remove)$/.exec(url.pathname)?.[1];
	if (request.method !== 'POST' || !action) return undefined;
	const { adapter } = runtime;
	if (!adapter) return Promise.resolve(failure(409, elsewhere));
	if (action === 'add') return add(request, runtime, adapter).catch(requestFailure);
	if (!adapter.status().active) return Promise.resolve(failure(409, elsewhere));
	const source = url.searchParams.get('source');
	if (!source || !isTrackerAdapterSourceId(source))
		return Promise.resolve(failure(400, 'A Tracker adapter source ID is required'));
	if (action === 'run') return run(request, adapter, source);
	return Promise.resolve()
		.then(() =>
			Response.json(
				changeTrackerAdapterSource(adapter.owner(), source, action as TrackerAdapterSourceAction)
			)
		)
		.catch(requestFailure);
}

async function add(
	request: Request,
	runtime: TrackerNativeRuntimeService,
	adapter: TrackerAdapterPollService
): Promise<Response> {
	const query = new URL(request.url).searchParams;
	const after = query.get('after');
	const since = after === null ? undefined : Date.parse(after);
	if (Number.isNaN(since)) return failure(400, '--after must be an ISO date/time');
	const source = prepareSource(await readItemBody(request), runtime, since);
	if (source.type === 'gmail' && query.get('backfill') === '1')
		return failure(400, 'Gmail adapters use --after to select a start time');
	if (!adapter.supports(source.type))
		return failure(409, 'Tracker adapter provider is not configured');
	if (query.get('dry-run') !== '1') {
		if (!adapter.status().active) return failure(409, elsewhere);
		return Response.json(addTrackerAdapterSource(adapter.owner(), source), { status: 201 });
	}
	const enabled_at = since ?? source.enabled_at;
	try {
		const preview = await adapter.preview(
			{ ...source, enabled_at },
			{ since: enabled_at - 5_000, backfill: query.get('backfill') === '1', signal: request.signal }
		);
		return Response.json({ status: 'polled', id: source.id, dry_run: true, ...preview });
	} catch {
		return failure(502, 'Tracker adapter intake failed');
	}
}

function prepareSource(
	input: Awaited<ReturnType<typeof readItemBody>>,
	runtime: TrackerNativeRuntimeService,
	since?: number
) {
	if (input.type !== 'gmail') {
		const source = trackerAdapterSourceInput(input, runtime.now());
		validateModel(source.model, runtime);
		return source;
	}
	const source = trackerMessageSourceInput(input, since ?? runtime.now());
	if (source.effect.kind === 'notify')
		source.effect.item_id = new TrackerItemReadRepository(runtime.store.database).resolve(
			source.effect.item_id
		).id;
	return source;
}

function validateModel(model: string | null, { ladderConfig }: TrackerNativeRuntimeService): void {
	if (!model) return;
	try {
		parseTrackerModelSpec(model, ladderFrom(ladderConfig));
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw trackerItemError(reason);
	}
}

async function run(
	request: Request,
	adapter: TrackerAdapterPollService,
	source: string
): Promise<Response> {
	const query = new URL(request.url).searchParams;
	const backfill = query.get('backfill') === '1';
	const backfillComments = query.get('backfill-comments') === '1';
	if (backfill && backfillComments) return failure(400, 'adapter run takes one backfill mode');
	try {
		const result = await adapter.poll(source, {
			dryRun: query.get('dry-run') === '1',
			backfill,
			backfillComments,
			signal: request.signal
		});
		if (result.status === 'polled') return Response.json(result);
		return result.status === 'inactive'
			? failure(404, 'Tracker adapter is missing or paused')
			: failure(409, 'Tracker adapter is busy or owned by another node');
	} catch {
		return failure(502, 'Tracker adapter intake failed');
	}
}

function requestFailure(error: unknown): Response {
	if (error instanceof Error && 'status' in error && typeof error.status === 'number')
		return failure(error.status, error.message);
	return failure(500, 'Tracker adapter change failed');
}

function failure(status: number, error: string): Response {
	return Response.json({ error }, { status });
}
