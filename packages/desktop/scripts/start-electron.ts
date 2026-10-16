import electron from 'electron';
import { spawn } from 'node:child_process';
const child = spawn(electron as unknown as string, [process.cwd()], {
	stdio: 'inherit',
	env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
});
child.on('error', (error) => {
	console.error(error.message);
	process.exitCode = 1;
});
child.on('exit', (code) => {
	process.exitCode = code ?? 1;
});
