import { expect, test } from 'vitest';
import { deploymentCommand } from '../../src/utils/deploymentCommand';
test('deployment commands pass literal arguments and hide command output on failure', async () => {
	expect(
		await deploymentCommand({
			args: [
				process.execPath,
				'-e',
				'process.stdout.write(process.argv[1])',
				'$(echo unsafe); literal'
			],
			cwd: process.cwd()
		})
	).toBe('$(echo unsafe); literal');
	await expect(
		deploymentCommand({
			args: [process.execPath, '-e', 'process.stderr.write("SYNTHETIC_SECRET");process.exit(1)'],
			cwd: process.cwd()
		})
	).rejects.toThrow('failed (1)');
});
