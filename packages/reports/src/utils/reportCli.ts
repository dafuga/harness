export interface CliOptions {
	operation: string;
	flags: Record<string, string | boolean>;
	positionals: string[];
}

export { reportCli, inputData, required } from '../services/report-command-service/reportCli';
