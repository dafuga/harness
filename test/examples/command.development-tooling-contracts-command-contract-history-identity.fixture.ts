import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TemporaryRepo } from '../support/temporary.types';

export function commitContract(repo: TemporaryRepo, id: string, uid: string): void {
	const path = `specification/units/${id}.json`;
	const fullPath = join(repo.root, path);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(
		fullPath,
		JSON.stringify({ id, uid, kind: 'command', owns: { source: ['src/commands/example.ts'] } })
	);
	repo.git('add', '--', path);
	repo.git('commit', '-m', `Add ${id}`);
}
