import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('build', () => {
	it('produces dist/cli/index.js', () => {
		execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
		expect(existsSync('dist/cli/index.js')).toBe(true);
	});
});

describe('CLI smoke', () => {
	it('shows help with all commands', () => {
		const output = execFileSync('npx', ['tsx', 'src/cli/index.ts', '--help'], {
			encoding: 'utf-8',
		});
		expect(output).toContain('gspend');
		expect(output).toContain('init');
		expect(output).toContain('status');
		expect(output).toContain('breakdown');
		expect(output).toContain('history');
		expect(output).toContain('budget');
		expect(output).toContain('watch');
	});

	it('shows version', () => {
		const output = execFileSync('npx', ['tsx', 'src/cli/index.ts', '--version'], {
			encoding: 'utf-8',
		});
		expect(output.trim()).toBe('0.0.1');
	});

	it('status without config gives ConfigError hint', () => {
		try {
			execFileSync('npx', ['tsx', 'src/cli/index.ts', 'status'], {
				encoding: 'utf-8',
				env: { ...process.env, XDG_CONFIG_HOME: '/tmp/gspend-test-nonexistent' },
				stdio: 'pipe',
			});
		} catch (error) {
			const err = error as { stderr: string };
			expect(err.stderr).toContain('gspend init');
		}
	});
});
