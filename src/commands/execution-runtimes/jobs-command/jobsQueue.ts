// @harness-uid u_uig432kach
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { QueueSnapshot } from '../../../services/execution-runtimes/QueueEtaService.types';
import type { JobsOptions } from '../JobsCommand.types';
const job = z.object({
	id: z.string().optional(),
	model: z.string().min(1),
	type: z.string().min(1),
	startedAt: z.number().finite().nonnegative().optional()
});
const queueSchema = z.object({
	queued: z.array(job),
	running: z.array(job),
	slots: z.record(z.string(), z.number().int().nonnegative().max(10000)),
	warnings: z.array(z.string()).optional()
});
/** Explicit what-if counts replace the queue while retaining observed model capacity. */
export function jobsQueue(options: JobsOptions, live: QueueSnapshot): QueueSnapshot {
	const queue = options.queue
		? queueSchema.parse(JSON.parse(readFileSync(options.queue, 'utf8')))
		: live;
	if (options.slots) queue.slots = { ...queue.slots, ...jobSlots(options.slots) };
	if (options.whatIf !== undefined) {
		const count =
			options.whatIf === 'all-modules' ? moduleCount(options.project) : Number(options.whatIf);
		if (!Number.isSafeInteger(count) || count < 0 || count > 1000000)
			throw new ExpectedCliError('What-if count must be an integer from 0 to 1000000');
		if (!options.type || !options.model)
			throw new ExpectedCliError('What-if requires --type and --model');
		return {
			queued: Array.from({ length: count }, () => ({ type: options.type!, model: options.model! })),
			running: [],
			slots: queue.slots,
			warnings: [
				`What-if only: ${count} jobs; excludes live work. Capacity is observed or explicitly overridden.`
			]
		};
	}
	return queue;
}
function moduleCount(project?: string): number {
	const directory = join(
		project ?? join(homedir(), 'projects/harness-integration'),
		'specification/units'
	);
	return readdirSync(directory)
		.filter((file) => file.endsWith('.json'))
		.filter((file) => {
			const unit = JSON.parse(readFileSync(join(directory, file), 'utf8'));
			return unit.status !== 'retired' && !unit.retired;
		}).length;
}
function jobSlots(input: string): Record<string, number> {
	const slots: Record<string, number> = {};
	for (const part of input.split(',')) {
		const match = /^([a-zA-Z0-9_-]+)=(\d+)$/.exec(part);
		if (!match || Number(match[2]) > 10000)
			throw new RangeError('Use --slots model=count,model=count (0 to 10000)');
		slots[match[1]] = Number(match[2]);
	}
	return slots;
}
