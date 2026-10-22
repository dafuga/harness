import { spawn } from 'node:child_process';
export async function reportProcess(
	command: string,
	args: string[],
	cwd?: string,
	environment?: NodeJS.ProcessEnv
) {
	return new Promise<{ code: number; output: string; durationMs: number }>((resolve, reject) => {
		const start = Date.now();
		const child = spawn(command, args, {
			cwd,
			env: environment ?? process.env,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let output = '';
		const receive = (part: Buffer) => {
			output += part.toString();
			if (output.length > 2_000_000) output = output.slice(-2_000_000);
		};
		child.stdout.on('data', receive);
		child.stderr.on('data', receive);
		child.on('error', reject);
		child.on('close', (code) =>
			resolve({ code: code ?? -1, output, durationMs: Date.now() - start })
		);
	});
}
