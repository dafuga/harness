import type { Guide } from './guide';

const consoleGuide: Guide = {
	topic: 'console',
	summary: 'Serve the Harness console inside a SvelteKit application, behind its own admin policy.',
	steps: [
		'Run harness history build --out <directory> to produce the history index of the repository.',
		'Write the policy in the host: a server-only module that exports a function taking the ' +
			'request event and returning true only for an administrator.',
		'Run harness console install --host <dir> --policy <module> --data <directory>.',
		'Add @dafuga01/harness to the host, build it with its own adapter and deploy as usual.',
		'Run the install again with a newer index to refresh the bundled history.',
		'For a history with recorded media, install with --bucket <binding> and upload the index ' +
			'to that private bucket; harness console objects prints what it must hold.',
		'After the last build step run harness verify stamp on the emitted directory, so a server ' +
			'that cannot read its own files reports which build it is.'
	],
	rules: [
		'The policy is required and is the host own: Harness adds no login, session or credential. ' +
			'A request is admitted only when the policy returns exactly true; a policy that throws denies.',
		'The console page, its JSON, its media and its exports each pass the policy before anything ' +
			'is read. Paths are matched against the shapes of an index, so nothing else can be asked for.',
		'History and media are modules under $lib/server, loaded on demand. They are in the server ' +
			'bundle only: not in static assets, not in the client bundle, with no public path.',
		'The generated code uses web platform APIs alone, so it runs on Cloudflare Workers with ' +
			'adapter-cloudflare. A build with another adapter that drops server routes is unaffected.',
		'Harness own server admits one owner: HARNESS_OWNER_MODE=loopback, bound to a loopback ' +
			'address, and only a peer that connects from loopback. Host and forwarding headers are ' +
			'never authorization, and owner mode is refused behind an address header.',
		'An install never loses content silently. A file the host wrote, or one edited since it was ' +
			'installed, stops the install until you choose: --update replaces it, --keep leaves it.',
		'A replaced or removed file is first saved under .harness/console/replaced/<sha256>, and ' +
			'harness.console.json records the path, the reason and the hash of both sides. ' +
			'harness console restore <path> puts the saved contents back and records that too.',
		'Changed host files are ordinary changes of the host: they show in Git, in its unit ' +
			'registry and impact, and need a reason like any other change.',
		'Harness own /harness area shows one application: reports, media, exports, uploads, analytics ' +
			'and agent CPU are limited on the server to checkouts of the repository the server is hosted ' +
			'for. That repository is known by its remote address or, without one, its own Git store; ' +
			'shared template history and names decide nothing, and what cannot be attributed is left out.',
		'Each branch, commit and view is its own path: <base>/branch/<name>/commit/<sha>/<view>, or ' +
			'<base>/commit/<sha>/<view> for a commit on no branch. The root and the earlier query form ' +
			'redirect to it, and a path that names nothing in the history says so.',
		'The index states what every commit changed against its first parent, computed from the ' +
			'source of both commits as harness impact does. No verification record is needed for it.',
		'Each capture shows the build and revision it names, its standing and the attempt it ' +
			'belongs to. A rejected or inherited capture is never shown as tested at the selected commit.',
		'A bundled history counts against the size of a Worker script: 3 MiB compressed on the free ' +
			'plan, 10 MiB on a paid one. The installer reports the compressed size of what it bundles. ' +
			'With --bucket nothing is bundled: the store is opened from the binding of a request the ' +
			'policy admitted, and a binding has no public address.',
		'<base>/data/build.json answers, behind the policy, with the stamp of the emitted build, the ' +
			'package name and version, and the host revision the build was given. They may differ.',
		'harness console uninstall removes what an install wrote and nobody changed, puts back what ' +
			'it replaced, and removes an edited file only with --update, after saving and recording it.',
		'Two commits are compared exactly, however far apart: the index keeps one side per source ' +
			'tree and the console computes the impact from both, as harness impact does.'
	],
	antiPatterns: [
		'Do not decide access from a Host, Origin or forwarding header.',
		'Do not copy the index into static/ or import it from client code.',
		'Do not delete .harness/console/replaced while a change it backs is still under review.'
	],
	exampleCommands: [
		'harness console install --host . --policy $lib/server/harnessPolicy --data .cache/harness/history',
		'harness console install --host . --policy $lib/server/harnessPolicy --update',
		'harness console install --host . --policy $lib/server/harnessPolicy --keep',
		'harness console restore src/routes/harness/+server.ts --host .',
		'harness console install --host . --policy $lib/server/harnessPolicy --bucket HARNESS_HISTORY --prefix history',
		'harness console objects --data .cache/harness/history --prefix history --json',
		'harness verify stamp .svelte-kit',
		'harness console uninstall --host .'
	]
};

const edgeGuide: Guide = {
	topic: 'edge',
	summary: 'Run units where there is no file system or child process, such as Cloudflare Workers.',
	steps: [
		'Import from @dafuga01/harness/edge; it reaches no Node or Bun module.',
		'Wrap a function with HandlerRuntimeAdapter to run it in the same isolate.',
		'Import a .wasm file so the platform precompiles it, and hand the module to ' +
			'WasmModuleRuntimeAdapter. The kernel ships as @dafuga01/harness/kernel.wasm.',
		'Call a unit served elsewhere with HttpRuntimeAdapter, or serve one from a fetch handler ' +
			'with runtimeFetch.'
	],
	rules: [
		'Every target answers the same request and response contract as under Bun and Node.',
		'Workers refuse to compile Wasm from bytes at run time: pass the precompiled module. Bytes ' +
			'are accepted only on platforms that may compile them.',
		'A native process target is not available at the edge and is not exported there. It ' +
			'remains in @dafuga01/harness/runtime for Bun and Node.',
		'runtimeFetch speaks the wire contract of the Node runtime server: one JSON request per POST.'
	],
	antiPatterns: [
		'Do not import @dafuga01/harness/runtime in a Worker; it reads files and starts processes.',
		'Do not expose a served unit without your own authentication.'
	],
	exampleCommands: ['harness info runtime', 'harness kernel serve --port 0 --runtime wasm']
};

export const consoleGuides = [consoleGuide, edgeGuide];
