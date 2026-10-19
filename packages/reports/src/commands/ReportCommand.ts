import { ReportCommandService } from "../services/report-command-service/ReportCommandService";
export class ReportCommand {
	run(argv: string[]) {
		return new ReportCommandService().execute(argv);
	}
}
