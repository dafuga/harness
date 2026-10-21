import { pinnedToolchain } from './build-kernel/pinnedToolchain';

/**
 * Runs one tool of the Rust toolchain that rust-toolchain.toml pins, with the arguments given:
 *
 *   bun scripts/rust.ts cargo test --locked
 *
 * It ends as the tool ends. Without rustup or the pinned toolchain it ends with 1 and says why.
 */
const [tool = '', ...args] = process.argv.slice(2);
try {
	const pinned = pinnedToolchain(tool);
	const ended = Bun.spawnSync([pinned.command, ...args], {
		env: pinned.env,
		stdio: ['inherit', 'inherit', 'inherit']
	});
	process.exit(ended.exitCode);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
