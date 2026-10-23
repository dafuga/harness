import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskCompletionService } from '../../../../../../../src/services/verification-evidence/TaskCompletionService';
import type { RunContext } from '../../../../models/development-tooling/RunContext.types';
import { hostChanges } from '../../../../utils/development-tooling/hostChanges';
import { promoteChange } from '../../../../utils/development-tooling/promoteChange';
import { sourceSnapshot } from '../../../../utils/verification-evidence/sourceSnapshot';
import { changeExecute, recordChange } from './changeExecute';

export class ChangeRunService {
	async run(context: RunContext) {
		const host = hostChanges(context.root);
		const before = await sourceSnapshot(context.root),
			directory = await mkdtemp(join(tmpdir(), 'harness-change-'));
		try {
			let failure: Error | null = null;
			try {
				await changeExecute(context, { directory, observe: host.observe });
				await new TaskCompletionService(context.root).require({
					kind: 'coding',
					goal: context.request.text,
					units: [context.entity.id]
				});
			} catch (error) {
				failure = error instanceof Error ? error : new Error(String(error));
			}
			await recordChange(context, { before, host, failure });
			if (failure) {
				context.failureRecorded = true;
				throw failure;
			}
			return await promoteChange(context, before);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}
}
