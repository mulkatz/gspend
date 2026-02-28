export class GspendError extends Error {
	constructor(
		message: string,
		public readonly hint?: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class AuthError extends GspendError {
	constructor(message: string, hint?: string) {
		super(message, hint ?? 'Run: gcloud auth application-default login');
	}
}

export class PermissionError extends GspendError {
	constructor(
		message: string,
		public readonly missingPermissions: string[] = [],
		hint?: string,
	) {
		super(message, hint);
	}
}

export class ConfigError extends GspendError {
	constructor(message: string, hint?: string) {
		super(message, hint ?? 'Run: gspend init');
	}
}

export class ApiError extends GspendError {
	constructor(
		message: string,
		public readonly statusCode?: number,
		hint?: string,
	) {
		super(message, hint);
	}
}

export class BigQueryError extends GspendError {
	constructor(message: string, hint?: string) {
		super(message, hint ?? 'Check that billing export is enabled in your GCP Console.');
	}
}
