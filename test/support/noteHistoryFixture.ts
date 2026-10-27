import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Explanation } from '../../src/core/explanationTypes';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { HistoryNoteRepository } from '../../src/repositories/history-note-repository/HistoryNoteRepository';
import { VerificationStoreRepository } from '../../src/repositories/VerificationStoreRepository';
import { sealRecord } from '../../src/utils/sealRecord';
import { runCommand } from './cli';
import { measureProcess } from './cli-measurement/measureProcess';
import { verificationSample } from './verificationSample';

/** A real Git note history with cached, missing and mismatched verification entries. */
export async function noteHistoryFixture(
	dir: string,
	commits: string[],
	git: (args: string[]) => string,
	explanation: Explanation
): Promise<void> {
	const [cached, missing] = commits;
	const tree = git(['rev-parse', `${cached}^{tree}`]);
	const sample: Partial<VerificationRecord> = verificationSample();
	delete sample.id;
	const record = sealRecord({
		...(sample as Omit<VerificationRecord, 'id'>),
		source: { commit: cached, tree, base: null },
		components: [],
		measurements: []
	});
	const store = new VerificationStoreRepository(dir);
	await store.save(record, store.directoryFor(cached, record.startedAt));
	const evidence = { commit: 'a'.repeat(40), path: 'records/missing', manifest: 'b'.repeat(64) };
	const verification = {
		schemaVersion: 1 as const,
		kind: 'verification' as const,
		record: record.id,
		status: record.status,
		profile: record.profile.id,
		finishedAt: record.finishedAt,
		source: record.source,
		evidence
	};
	const notes = new HistoryNoteRepository(dir);
	await notes.append(cached, [verification]);
	await notes.append(missing, [
		{
			...verification,
			record: 'missing-verification',
			source: { commit: missing, tree: git(['rev-parse', `${missing}^{tree}`]), base: null }
		}
	]);
	for (let batch = 0; batch < 66; batch++) {
		const commit = git(['commit-tree', tree, '-m', `fixture note ${batch}`]);
		const entries = Array.from({ length: 800 }, (_, index) =>
			JSON.stringify({
				schemaVersion: 1,
				kind: 'reason',
				commit,
				explanation: { ...explanation, behavior: `${batch}:${index} ${'x'.repeat(512)}` }
			})
		);
		if (batch === 0) entries.push('{"kind":', JSON.stringify(verification));
		const file = join(dir, '.cache', 'bulk-note.txt');
		writeFileSync(file, `${entries.join('\n')}\n`);
		git(['notes', '--ref=harness', 'add', '-F', file, commit]);
	}
}

/** Compares restoration with a single raw read of the same note bytes in a fresh process. */
export async function noteHistoryMemory(dir: string, kind: 'raw' | 'restore') {
	const source = resolve(
		kind === 'raw'
			? 'src/adapters/git-source-history/GitAdapter.ts'
			: 'src/services/verification-evidence/EvidenceRestoreService.ts'
	);
	const operation =
		kind === 'raw'
			? `const git = new api.GitAdapter(root);
const list = await git.run(['notes', '--ref=refs/notes/harness', 'list']);
const ids = list.split('\\n').filter(Boolean).map(line => line.split(' ')[0]);
const bytes = await git.bytes(['cat-file', '--batch'], { input: ids.join('\\n') + '\\n' });
const value = bytes.length;`
			: 'const value = await new api.EvidenceRestoreService(root).restore();';
	const program = `const api = await import(${JSON.stringify(source)});
const root = process.argv[1]; ${operation}
console.log(JSON.stringify({value, rss: process.memoryUsage().rss}));`;
	const command = ['bun', '--eval', program, dir];
	const result =
		kind === 'raw'
			? await runCommand(command, process.cwd())
			: await measureProcess(
					{
						units: ['repository.history-note', 'service.evidence-restore'],
						workload: 'restore-large-note-history',
						target: 'module',
						command,
						cwd: process.cwd()
					},
					runCommand
				);
	return JSON.parse(result.stdout) as { value: unknown; rss: number };
}
