import { spawnSync } from 'node:child_process';
const cli = process.env.HARNESS_CLI_PATH;
const args = cli
	? ['bun', cli, 'audit', '.', '--profile', 'app']
	: ['harness', 'audit', '.', '--profile', 'app'];
const result = spawnSync(args[0], args.slice(1), { stdio: 'inherit' });
process.exit(result.status ?? 1);
