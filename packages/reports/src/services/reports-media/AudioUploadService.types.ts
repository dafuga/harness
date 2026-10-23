export interface AudioDetails {
	title: string;
	note: string;
	source: string;
}

export interface AudioUploadInput extends AudioDetails {
	audio: File;
}

export interface AudioComparisonInput extends AudioDetails {
	before: File;
	after: File;
}
