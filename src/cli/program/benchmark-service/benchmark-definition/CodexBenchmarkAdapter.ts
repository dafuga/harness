import type {
	BenchmarkCandidate,
	BenchmarkRunner,
	BenchmarkRunnerInput,
	BenchmarkTurn
} from '../../../../core/agents-providers/subagentBenchmarkTypes';
import { benchmarkProcess } from '../benchmarkProcess';
import { benchmarkEvents, codexTurn } from '../benchmarkEvents';

export class CodexBenchmarkAdapter implements BenchmarkRunner {
	constructor(private readonly executable = 'codex') {}
	async preflight(candidate: BenchmarkCandidate): Promise<string> {
		if (candidate.tools !== 'default' || candidate.effort === 'max')
			throw new Error('Unsupported Codex tool or effort setting.');
		const result = await benchmarkProcess({
			command: [this.executable, '--version'],
			cwd: process.cwd(),
			signal: AbortSignal.timeout(10000)
		});
		if (result.exitCode) throw new Error('Codex runner is unavailable.');
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
				'Codex runner failed; inspect authentication, model access, and local runner availability.'
			);
		const turn = codexTurn(benchmarkEvents(result.stdout));
		if (turn.reportedModel && turn.reportedModel !== input.candidate.model)
			throw new Error('Codex reported a different model.');
		return turn;
	}
	command(input: BenchmarkRunnerInput): string[] {
		const args = [this.executable, 'exec'];
		if (input.session) args.push('resume', input.session);
		else args.push('--sandbox', 'workspace-write');
		return [
			...args,
			'--json',
			'--ignore-user-config',
			'-m',
			input.candidate.model,
			'-c',
			`model_reasoning_effort=${JSON.stringify(input.candidate.effort)}`,
			'-c',
			'approval_policy="never"',
			'-c',
			'model_provider="openai"',
			'-'
		];
	}
}
