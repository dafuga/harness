import type { Guide } from './guide';

const runtimeGuide: Guide = {
	topic: 'runtime',
	summary: 'One typed request and response for every way a unit can run.',
	steps: [
		'List each way the unit can run in runtime.targets; runtime.kind and entry name the default.',
		'A module target names a file and a handler export that accepts a runtime request.',
		'A wasm target names a core Wasm file that exports the Harness JSON ABI.',
		'A process target names a command: one JSON request on stdin, one JSON response on stdout.',
		'An http target names the URL of a unit that is already served; POST one request to it.',
		'Create the runtime with UnitRuntimeService.forUnit, then call invoke.'
	],
	rules: [
		'A response is { ok: true, output } or { ok: false, error: { code, message } }.',
		'Transports never throw: failures are runtime-unavailable, runtime-failed, runtime-timeout ' +
			'or invalid-response.',
		'Only declared targets are used; an undeclared target is refused, never guessed.',
		'A request must be portable JSON: finite numbers, well-formed strings, plain objects and ' +
			'arrays, at most 64 levels deep. Every runtime refuses anything else as invalid-json.',
		'A result that arrives after timeoutMs is rejected as runtime-timeout. Process and HTTP ' +
			'targets are stopped at the deadline; module and Wasm targets run on the calling ' +
			'thread and cannot be interrupted, so use a process target for a hard limit.',
		'Functions stay plain functions. Declare a process or http target only for a unit that ' +
			'is deployed that way; nothing is routed over the network implicitly.',
		'A served unit has no authentication of its own: harness kernel serve binds to loopback.',
		'The JSON ABI is memory, harness_alloc(len), harness_free(ptr, len) and ' +
			'harness_invoke(ptr, len), which returns (pointer << 32) | length.',
		'Typed APIs ship in the package: import @dafuga01/harness/contracts and ' +
			'@dafuga01/harness/runtime. Neither starts the CLI.',
		'On Workers import @dafuga01/harness/edge instead: handler, precompiled Wasm and HTTP ' +
			'targets only. See harness info edge.'
	],
	antiPatterns: [
		'Do not parse a unit response without checking ok.',
		'Do not expose a served unit beyond loopback without your own authentication.',
		'Do not mark a runtime as the default because it is native; measure it.'
	],
	exampleCommands: [
		'harness units show kernel.impact-kernel',
		'harness kernel serve --port 0 --runtime wasm',
		'harness impact --runtime wasm'
	]
};

const impactGuide: Guide = {
	topic: 'impact',
	summary: 'What a change affects, computed over both the base and the head dependency graph.',
	steps: [
		'Commit or stage nothing special: the working tree is compared with HEAD by default.',
		'Read direct, indirect, added and removed units, selected tests and affected scenarios.',
		'Resolve reported uncertainty by declaring the reference or the contract it stands for.',
		'Compare two commits with --base and --head, for example a pull request base and head.'
	],
	rules: [
		'Edges come from imports, re-exports, declared process, HTTP, Wasm and contract ' +
			'dependencies, unit ownership and scenario contracts.',
		'A removed file or dropped dependency still reaches its dependents through the base graph.',
		'A changed file that still exists needs a test or scenario in the head graph; coverage ' +
			'in the base graph counts only for a file that was removed.',
		'A changed test selects itself and the scenarios it proves.',
		'A changed manifest reruns the tests of the unit it describes.',
		'Global configuration, unclassified files and files no test depends on select every test.',
		'A file with a computed or unresolved reference is selected whenever anything changes.',
		'Every widening is listed under uncertain with its reason; nothing is dropped silently.'
	],
	antiPatterns: [
		'Do not treat an empty selection as proof when the report lists uncertainty.',
		'Do not hide a file from impact by leaving it unclassified.'
	],
	exampleCommands: [
		'harness impact',
		'harness impact --base origin/main --head HEAD --json',
		'harness impact --runtime process'
	]
};

const kernelGuide: Guide = {
	topic: 'kernel',
	summary: 'The impact kernel: a TypeScript reference and a Rust build for native and Wasm.',
	steps: [
		'Install the toolchain pinned in rust-toolchain.toml; it includes wasm32-unknown-unknown.',
		'Run bun run build:kernel to build the native process and the core Wasm module.',
		'Run bun run check:kernel for cargo fmt --check, clippy with warnings denied, and tests.',
		'Run harness kernel parity to compare both builds with the reference.',
		'Run harness kernel bench --write to record measurements for this machine.',
		'Run harness kernel default to see which runtime those measurements select.'
	],
	rules: [
		'crates/impact-kernel/tests/vectors.json is shared by the Rust tests and every adapter test.',
		'A behaviour change lands in the reference and the Rust kernel together, with a vector.',
		'Built artifacts live in target/kernel; the package ships the Wasm module, not the binary.',
		'The default is the lowest measured cold latency for this machine profile; within 5% ' +
			'the simpler runtime wins. Without a measurement the reference is used and says so.',
		'Benchmarks time serialization, invocation and parsing; memory is reported only where ' +
			'it can be attributed, otherwise as unavailable with a reason.',
		'A benchmark run is calibration, never verification evidence or a budget baseline; a ' +
			'run from an uncommitted tree names no tested revision.',
		'Rust sources follow the Harness size limits and document every unsafe block.'
	],
	antiPatterns: [
		'Do not change one implementation without the other.',
		'Do not compare measurements taken on different machine profiles.'
	],
	exampleCommands: [
		'bun run build:kernel',
		'bun run check:kernel',
		'harness kernel parity',
		'harness kernel bench --write',
		'harness kernel default --json'
	]
};

export const runtimeGuides: Guide[] = [
	runtimeGuide,
	impactGuide,
	kernelGuide,
	{ ...kernelGuide, topic: 'rust' }
];
