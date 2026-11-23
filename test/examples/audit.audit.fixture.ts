import type { Files } from './audit.audit.test.types';

export const version = "export const version = '1.0.0';\n";

export const twoClasses = 'export class Money {}\nexport class Currency {}\n';

export const ignoreMoney = '{"ignore":[{"path":"src/lib/money.ts","rule":"max-classes-per-file"}]}';

export const libraryCoverage: Files = {
	'dist/index.js': 'export {};\n',
	'node_modules/left-pad/index.js': 'module.exports = {};\n',
	'src/index.ts': version,
	'tools/gen/main.go': 'package main\n'
};

export const appCoverage: Files = {
	'.svelte-kit/output.js': 'export {};\n',
	'harness.audit.json': ignoreMoney,
	'src/lib/Banner.svelte': '<script lang="ts">\n\tlet n = 0;\n</script>\n<p>{n}</p>\n',
	'src/lib/money.ts': twoClasses,
	'svelte.config.js': 'export default {};\n',
	'tools/gen/main.go': 'package main\n'
};
