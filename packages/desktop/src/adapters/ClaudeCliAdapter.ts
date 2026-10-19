import type { AgentRunner, AgentTurn, CliCommand } from '../models/AgentRunner.types';
import { claudeState } from '../utils/claudeState';
import { claudeTurn } from '../utils/claudeTurn';
export class ClaudeCliAdapter implements AgentRunner {
	constructor(private command: CliCommand = { command: 'claude', args: [] }) {}
	discover() {
		return claudeState(this.command);
	}
	run(turn: AgentTurn) {
		return claudeTurn(this.command, turn);
	}
}
