// @harness-uid u_7n2divksx4
import type { PlannedFile } from '../../core/development-tooling/files';
import type { ProjectTemplateInput } from '../projects-sessions/project.types';

export function godotProjectFiles(input: ProjectTemplateInput): PlannedFile[] {
	const { name, dimension = '2d' } = input;
	const root = dimension === '3d' ? 'Node3D' : 'Node2D';
	return [
		{
			path: 'package.json',
			contents:
				JSON.stringify(
					{
						name,
						private: true,
						type: 'module',
						harness: { kind: 'game', engine: 'godot', dimension },
						scripts: {
							test: 'bun scripts/godot.ts test',
							build: 'bun run build:native && bun run build:web',
							'build:native': 'bun scripts/godot.ts native',
							'build:web': 'bun scripts/godot.ts web',
							check: 'bun run test && harness audit .'
						}
					},
					null,
					'\t'
				) + '\n'
		},
		{ path: 'project.godot', contents: gameConfig(name) },
		{
			path: 'game.tscn',
			contents: '[gd_scene format=3]\n\n[node name="Game" type="' + root + '"]\n'
		},
		{ path: 'tests/smoke.gd', contents: smokeTest(root) },
		{ path: 'export_presets.cfg', contents: exportPresets() },
		{ path: 'scripts/godot.ts', contents: godotRunner },
		{ path: '.gitignore', contents: '.godot/\nbuild/\nnode_modules/\n' },
		{ path: 'README.md', contents: gameReadme(name) },
		{
			path: 'AGENTS.md',
			contents:
				'Run `bun run check` before delivery. Use headless Godot for scene tests and exports. Render screenshots through a display or a headless browser running the web export.\n'
		},
		{
			path: '.codex/skills/harness/SKILL.md',
			contents:
				'---\nname: harness\ndescription: Create, test, and export this Harness Godot game.\n---\n\nUse `bun run check` and `bun run build`. Follow AGENTS.md.\n'
		}
	];
}

function gameConfig(name: string): string {
	return `config_version=5

[application]
config/name="${name}"
run/main_scene="res://game.tscn"
config/features=PackedStringArray("4.6", "GL Compatibility")

[display]
window/size/viewport_width=800
window/size/viewport_height=450

[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
textures/vram_compression/import_etc2_astc=true
`;
}

function smokeTest(root: string): string {
	return `extends SceneTree

func _initialize() -> void:
	var game := preload("res://game.tscn").instantiate()
	if not game is ${root}:
		push_error("Game scene has the wrong root type")
		game.free()
		quit(1)
		return
	game.free()
	print("Harness Godot scene ready")
	quit()
`;
}

function exportPresets(): string {
	return `[preset.0]
name="macOS"
platform="macOS"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter="tests/*"
export_path="build/native/game.zip"

[preset.0.options]
application/bundle_identifier="org.harness.game"
codesign/codesign=1
notarization/notarization=0

[preset.1]
name="Web"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter="tests/*"
export_path="build/web/index.html"

[preset.1.options]
variant/thread_support=false
`;
}

function gameReadme(name: string): string {
	return `# ${name}

Install Godot 4.6 and its matching macOS and Web export templates. Set
\`GODOT_BIN\` when the Godot executable is outside PATH.

- \`bun run check\` runs the headless scene test and Harness audit.
- \`bun run build:native\` exports an ad-hoc signed macOS ZIP for local testing.
- \`bun run build:web\` exports the Web game.
- \`bun run build\` exports both.

Exercise scene behavior with headless Godot. To capture rendered screenshots
in CI, open the Web export in headless Chromium and wait for the target scene
to render before capturing.

For Antelope calls, integrate the pinned upstream WharfKit Godot addon behind
the game's network capability boundary. Verify the addon on the intended
export target before enabling wallet access. Test scenes use disposable data.
`;
}

const godotRunner = `import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const mode = process.argv[2];
const godot = process.env.GODOT_BIN || 'godot';

/** The command line named a mode this script does not offer. */
class UnknownModeError extends Error {
	override name = 'UnknownModeError';
}

function run(args: string[]) {
	const processResult = Bun.spawnSync([godot, '--headless', '--path', '.', ...args], {
		stdout: 'inherit', stderr: 'inherit'
	});
	if (processResult.exitCode !== 0) process.exit(processResult.exitCode || 1);
}

if (mode === 'test') {
	run(['--script', 'res://tests/smoke.gd']);
} else {
	const configs = {
		native: { preset: 'macOS', output: 'build/native/game.zip' },
		web: { preset: 'Web', output: 'build/web/index.html' }
	} as const;
	if (mode !== 'native' && mode !== 'web') {
		throw new UnknownModeError('Choose test, native, or web.');
	}
	const { preset, output } = configs[mode];
	mkdirSync(dirname(output), { recursive: true });
	run(['--export-release', preset, output]);
}
`;
