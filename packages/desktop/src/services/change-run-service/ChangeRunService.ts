import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunContext } from "../../models/RunContext.types.ts";
import { sourceSnapshot } from "../../utils/sourceSnapshot";
import { hostChanges } from "../../utils/hostChanges";
import { changeExecute, recordChange } from "./changeExecute";

export class ChangeRunService {
	async run(context: RunContext) {
		const host = hostChanges(context.root);
		const before = await sourceSnapshot(context.root),
			directory = await mkdtemp(join(tmpdir(), 'harness-change-'));
		try {
			let failure: Error | null = null;
			try {
				await changeExecute(context, { directory, observe: host.observe });
			} catch (error) {
				failure = error instanceof Error ? error : new Error(String(error));
			}
			await recordChange(context, { before, host, failure });
			if (failure) {
				context.failureRecorded = true;
				throw failure;
			}
			return 'Code changes recorded. Verification is still required.';
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}
}
