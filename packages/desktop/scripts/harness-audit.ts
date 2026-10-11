const harnessCliPath = process.env.HARNESS_CLI_PATH;
const args = harnessCliPath
	? ['bun', harnessCliPath, 'audit', '.', '--profile', 'app']
	: ['harness', 'audit', '.', '--profile', 'app'];

const result = Bun.spawnSync(args, {
	stdout: 'inherit',
	stderr: 'inherit'
});

process.exit(result.exitCode);
