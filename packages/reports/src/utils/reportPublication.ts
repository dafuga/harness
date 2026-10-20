export interface PublicationFile {
	path: string;
	bytes: Buffer;
	mime: string;
	sha256: string;
}

export interface PublicationBundle {
	id: string;
	directory: string;
	digest: string;
	revision?: string;
	files: PublicationFile[];
}

export { reportPublication } from '../services/report-publish-service/reportPublication';
