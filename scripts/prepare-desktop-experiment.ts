import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { access, mkdir, rename } from 'node:fs/promises';
import { DesktopArchiveAdapter } from '../src/adapters/DesktopArchiveAdapter';
import { DesktopExperimentService } from '../src/services/DesktopExperimentService';
import { desktopPatchConfig } from '../src/config/desktopPatchConfig';
import { DesktopIntegrityAdapter } from '../src/adapters/DesktopIntegrityAdapter';

const source = '/Applications/ChatGPT.app';
const target = join(homedir(), 'Applications/Codex Harness Experimental.app');
if (resolve(source) === resolve(target)) throw new Error('Separate app copy required');
const processes = Bun.spawn(['/bin/ps', '-axo', 'command='], { stdout: 'pipe', stderr: 'pipe' });
const running = await new Response(processes.stdout).text();
if ((await processes.exited) !== 0) throw new Error('Could not check running desktop processes');
if (running.split('\n').some((line) => line.startsWith(join(target, 'Contents/MacOS/'))))
	throw new Error('Quit the experimental app before preparing it');
const cache = join(import.meta.dir, '../.cache/codex-picker-evidence/desktop-copy');
await mkdir(cache, { recursive: true, mode: 0o700 });
const archive = new DesktopArchiveAdapter();
const sourceAsar = join(source, 'Contents/Resources/app.asar');
const changes = new DesktopExperimentService().plan(
	archive.read(sourceAsar, Object.keys(desktopPatchConfig.assets)),
	{
		dataPath: join(homedir(), 'Library/Application Support/Codex Harness Experimental'),
		catalogPath: join(homedir(), '.codex/harness-gateway/claude-models.json')
	}
);
const build = await Bun.build({
	entrypoints: [join(import.meta.dir, '../src/services/NativePickerBridgeService.ts')],
	target: 'browser',
	format: 'esm'
});
if (!build.success) throw new Error('Bridge build failed');
changes.set('webview/assets/harness-native-picker.js', await build.outputs[0].text());
const temporary = join(cache, 'patched.asar');
const hash = await archive.patch(sourceAsar, temporary, changes);
const info = join(target, 'Contents/Info.plist');
await rename(temporary, join(target, 'Contents/Resources/app.asar'));
const edits = [
	['Set :ElectronAsarIntegrity:Resources/app.asar:hash ' + hash],
	['Set :CFBundleIdentifier com.dafuga.codex.harness.experimental'],
	['Set :CFBundleDisplayName Codex Harness Experimental'],
	['Set :CFBundleName Codex Harness Experimental'],
	['Delete :CFBundleURLTypes']
];
for (const [edit] of edits) {
	const child = Bun.spawn(['/usr/libexec/PlistBuddy', '-c', edit, info], {
		stdout: 'pipe',
		stderr: 'pipe'
	});
	if ((await child.exited) !== 0 && !edit.startsWith('Delete '))
		throw new Error(`Plist edit failed: ${edit}`);
}
await new DesktopIntegrityAdapter().update(target);
const native = join(target, 'Contents/MacOS/CodexHarnessElectron');
try {
	await access(native);
} catch {
	await rename(join(target, 'Contents/MacOS/ChatGPT'), native);
}
const launcher = Bun.spawn(
	[
		process.execPath,
		'build',
		'--compile',
		join(import.meta.dir, 'desktop-experiment-launcher.ts'),
		'--outfile',
		join(target, 'Contents/MacOS/ChatGPT')
	],
	{ stdout: 'pipe', stderr: 'pipe' }
);
if ((await launcher.exited) !== 0) throw new Error('Desktop launcher build failed');
await Bun.write(
	join(cache, 'build.json'),
	JSON.stringify(
		{
			source,
			target,
			version: desktopPatchConfig.version,
			headerHash: hash,
			bridgeBytes: build.outputs[0].size
		},
		null,
		2
	)
);
console.log(`Prepared experimental copy: ${target}`);
