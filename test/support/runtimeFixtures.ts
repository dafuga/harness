import type { Reply, FixtureServer } from './runtimeFixtures.types';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const ok = '{"ok":true,"output":{"echo":true}}';

/** Arguments that make the current JavaScript runtime behave like a JSON process unit. */
export function scripted(body: string): { command: string; args: string[] } {
	return { command: process.execPath, args: ['-e', body] };
}

export const scripts = {
	echo: `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('${ok}'))`,
	garbage: `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('not json'))`,
	shape: `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('{"ok":true}'))`,
	crash: `process.stderr.write('boom');process.exit(3)`,
	hang: `setInterval(()=>{},1000)`,
	lines: [
		`const rl=require('node:readline').createInterface({input:process.stdin});`,
		`rl.on('line',(line)=>{const request=JSON.parse(line);`,
		`if(request.operation==='hang')return;`,
		`if(request.operation==='garbage')return console.log('not json');`,
		`console.log(JSON.stringify({ok:true,output:{pid:process.pid,operation:request.operation}}));});`
	].join('')
};

export async function fixtureServer(routes: Record<string, Reply>): Promise<FixtureServer> {
	const server: Server = createServer((request, response) => {
		const reply = routes[request.url ?? '/'];
		request.resume();
		if (reply === 'hang' || !reply) return;
		response.writeHead(reply.status, { 'content-type': 'application/json' });
		response.end(reply.body);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return {
		url: `http://127.0.0.1:${port}`,
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			})
	};
}

export type { FixtureServer } from './runtimeFixtures.types';
