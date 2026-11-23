import type { Case } from './service.execution-runtimes-queue-eta.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { JobStatisticsService } from '../../src/services/execution-runtimes/JobStatisticsService';
import { QueueEtaService } from '../../src/services/execution-runtimes/QueueEtaService';
import type { JobRecord } from '../../src/repositories/execution-runtimes/JobHistoryRepository.types';
import type {
	QueueEstimate,
	QueueJob,
	QueueSnapshot
} from '../../src/services/execution-runtimes/QueueEtaService.types';

const NOW = 1_700_000_000_000;
const DURATIONS = Array.from({ length: 10 }, (_, index) => (index + 1) * 1000);

function history(durations: number[]): JobRecord[] {
	return durations.map((durationMs, index) => ({
		id: `history-${index}`,
		source: 'fixture',
		attempt: 1,
		unit: 'unit.fixture',
		type: 'test',
		model: 'm1',
		startedAt: 0,
		endedAt: durationMs,
		durationMs,
		outcome: 'pass'
	}));
}

function service(records: JobRecord[]): QueueEtaService {
	return new QueueEtaService(new JobStatisticsService(records));
}

function job(model: string, id = 'j'): QueueJob {
	return { id, type: 'test', model };
}

function summarise(result: QueueEstimate) {
	return {
		status: result.status,
		queued: result.queued,
		running: result.running,
		p50Ms: result.p50Ms,
		p90Ms: result.p90Ms,
		finish: result.finish,
		warnings: result.warnings
	};
}

function record(state: string, cases: Case[]): boolean {
	return recordExampleCases(
		{
			unitId: 'service.execution-runtimes-queue-eta',
			symbol: 'estimate',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Estimates queued jobs across the model slot lanes', () => {
	const queue: QueueSnapshot = {
		queued: [job('m1', 'a'), job('m1', 'b'), job('m1', 'c')],
		running: [],
		slots: { m1: 2 }
	};
	const result = service(history(DURATIONS)).estimate(queue, NOW);

	expect(result.status).toBe('estimated');
	expect(result.p50Ms).toBe(11000);
	expect(result.p90Ms).toBe(18000);
	expect(result.finish.p50).toContain('Europe/Lisbon');
	record('estimates-queued-jobs-across-the-model-slot-lanes', [
		{
			name: 'three queued jobs on two m1 slots',
			input: { queue, now: NOW },
			output: summarise(result)
		}
	]);
});

test('Blocks the estimate when a model has no slots', () => {
	const queue: QueueSnapshot = { queued: [job('m2')], running: [], slots: { m1: 2, m2: 0 } };
	const result = service(history(DURATIONS)).estimate(queue, NOW);

	expect(result.status).toBe('blocked');
	expect(result.p50Ms).toBeNull();
	expect(result.warnings).toContain('No live capacity for m2; set --slots explicitly');
	record('blocks-the-estimate-when-a-model-has-no-slots', [
		{
			name: 'queued m2 job with zero m2 slots',
			input: { queue, now: NOW },
			output: summarise(result)
		}
	]);
});

test('Reports unknown status when no duration history exists', () => {
	const queue: QueueSnapshot = { queued: [job('m1')], running: [], slots: { m1: 1 } };
	const result = service([]).estimate(queue, NOW);

	expect(result.status).toBe('unknown');
	expect(result.p50Ms).toBeNull();
	expect(result.warnings).toContain('No duration samples for test/m1');
	record('reports-unknown-status-when-no-duration-history-exists', [
		{
			name: 'queued m1 job with an empty history',
			input: { queue, now: NOW },
			output: summarise(result)
		}
	]);
});

test('Extrapolates the tail of a running job past every sample', () => {
	const running = { ...job('m1', 'r'), startedAt: NOW - 20000 };
	const queue: QueueSnapshot = { queued: [], running: [running], slots: { m1: 1 } };
	const result = service(history(DURATIONS)).estimate(queue, NOW);

	expect(result.status).toBe('estimated');
	expect(result.p50Ms).toBe(1100);
	expect(result.warnings).toContain('Running r exceeds every sample; residual tail extrapolated');
	record('extrapolates-the-tail-of-a-running-job-past-every-sample', [
		{
			name: 'running job elapsed 20s beyond a 10s maximum sample',
			input: { queue, now: NOW },
			output: summarise(result)
		}
	]);
});

test('Rejects slot counts outside the safe integer range', () => {
	const queue: QueueSnapshot = { queued: [job('m1')], running: [], slots: { m1: 10001 } };
	let error: unknown;
	try {
		service(history(DURATIONS)).estimate(queue, NOW);
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(RangeError);
	expect((error as Error).message).toBe('Slots must be integers from 0 to 10000');
	record('rejects-slot-counts-outside-the-safe-integer-range', [
		{
			name: 'm1 slot count of 10001 is above the limit',
			input: { queue, now: NOW },
			error: { name: (error as Error).name, message: (error as Error).message }
		}
	]);
});
