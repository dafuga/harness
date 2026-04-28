import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { auditPath } from '../src/audit/audit';

test('audit reports oversized files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-audit-'));
	const longFile = Array.from({ length: 225 }, (_, index) => `export const value${index} = ${index};`);

	await writeFile(join(root, 'large.ts'), longFile.join('\n'));

	const findings = await auditPath(root);

	expect(findings.some((finding) => finding.rule === 'small-file')).toBe(true);
	await rm(root, { recursive: true, force: true });
});
