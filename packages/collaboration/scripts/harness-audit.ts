// @harness-uid u_ot4k46vz37
const harnessCliPath = process.env.HARNESS_CLI_PATH;
const args = harnessCliPath
	? ['bun', harnessCliPath, 'audit', '.', '--profile', 'lib']
	: ['harness', 'audit', '.', '--profile', 'lib'];

const result = Bun.spawnSync(args, {
	stdout: 'inherit',
	stderr: 'inherit'
});

process.exit(result.exitCode);
