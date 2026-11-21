import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { runCommand } from './support/cli';
import { withTempDir } from './support/temporary';
import { expect } from './verificationExpect';

const base = process.env.HARNESS_TEST_DOCKER_BASE;
test.skipIf(!base)(
	'Linux guest tracker completes its scoped host-signed run and leaves no task Docker resources',
	() =>
		withTempDir('htrk-proof-', async (cwd) => {
			const image = await runCommand(
				['docker', 'image', 'inspect', '--format={{.Id}}', base!],
				cwd
			);
			const file = fileURLToPath(new URL('./support/trackerGuestDockerProof.ts', import.meta.url));
			const result = await runCommand(['bun', file, image.stdout.trim()], cwd);
			expect(JSON.parse(result.stdout)).toEqual({
				item: 'done',
				run: 41,
				journalWrites: 6,
				cleanup: true
			});
		}),
	60_000
);
