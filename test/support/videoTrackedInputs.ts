import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { VideoEvidenceService } from '../../src/services/verification-evidence/VideoEvidenceService';
import type { VideoDeclaration } from '../../src/utils/verification-evidence/videoClipSchema.types';

/** A conservative source proof widens to tracked source, never local credentials or output. */
export async function assertTrackedVideoInputs(root: string, manifest: VideoDeclaration) {
	const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
	git('init', '-q');
	git('add', '-A');
	git(
		'-c',
		'user.name=Fixture',
		'-c',
		'user.email=fixture@example.invalid',
		'commit',
		'-qm',
		'feat: track fixture'
	);
	const service = new VideoEvidenceService(root),
		previous = service.plan(manifest).record;
	await writeFile(join(root, '.env.local'), 'FIXTURE_ONLY=private-local-value');
	await mkdir(join(root, 'output'), { recursive: true });
	await writeFile(join(root, 'output', 'runtime-created.ts'), 'generated runtime output');
	await writeFile(join(root, 'untracked-runtime.ts'), 'untracked runtime input');
	const next = service.plan(manifest, previous);
	expect(next.record, 'untracked runtime files cannot enter source dependency proof').toEqual([]);
	expect(next.reuse).toEqual(previous);
	expect(
		next.reuse.every((slot) => !slot.dependencies?.some((path) => path.includes('.env.local')))
	).toBe(true);
	await writeFile(join(root, 'src/unrelated.ts'), 'tracked dynamic dependency changed');
	expect(service.plan(manifest, previous).record.map((slot) => slot.clipId)).toEqual([
		'first',
		'first'
	]);
}
