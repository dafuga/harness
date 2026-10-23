import type {
	BenchmarkCandidate,
	BenchmarkRunner,
	BenchmarkRunnerInput,
	BenchmarkTurn
} from '../../../../core/agents-providers/subagentBenchmarkTypes';
import { benchmarkProcess } from '../benchmarkProcess';
import { benchmarkEvents, claudeTurn } from '../benchmarkEvents';

export class ClaudeBenchmarkAdapter implements BenchmarkRunner {
	constructor(private readonly executable = 'claude') {}
	async preflight(_candidate: BenchmarkCandidate): Promise<string> {
		const result = await benchmarkProcess({
			command: [this.executable, '--version'],
			cwd: process.cwd(),
			signal: AbortSignal.timeout(10000)
		});
		if (result.exitCode) throw new Error('Claude runner is unavailable.');
		return result.stdout.trim();
	}
	async run(input: BenchmarkRunnerInput): Promise<BenchmarkTurn> {
		const result = await benchmarkProcess({
			command: this.command(input),
			cwd: input.cwd,
			input: input.prompt,
			signal: input.signal
		});
		if (result.exitCode)
			throw new Error(
				'Claude runner failed; inspect authentication, model access, and local runner availability.'
			);
		const turn = claudeTurn(benchmarkEvents(result.stdout));
		if (turn.reportedModel && turn.reportedModel !== input.candidate.model)
			throw new Error('Claude reported a different model.');
		return turn;
	}
	command(input: BenchmarkRunnerInput): string[] {
		const args = [
			this.executable,
			'-p',
			'--output-format',
			'stream-json',
			'--verbose',
			'--model',
			input.candidate.model,
			'--effort',
			input.candidate.effort,
			'--permission-mode',
			'bypassPermissions',
			'--safe-mode',
			'--setting-sources',
			'',
			'--strict-mcp-config',
			'--mcp-config',
			'{"mcpServers":{}}',
			'--tools',
			input.candidate.tools === 'files' ? 'Read,Edit,Write,Glob,Grep' : 'default'
		];
		if (input.session) args.push('--resume', input.session);
		return args;
	}
}
