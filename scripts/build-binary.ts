#!/usr/bin/env bun

// Build a standalone binary of gspend using Bun's compiler.
// Two-step process:
// 1. Bundle to a single JS file (with devtools stub to avoid Ink's optional dependency)
// 2. Compile the bundle to a standalone binary

const target = Bun.argv[2] as string | undefined;

const pkgJson = await Bun.file('package.json').json();

const result = await Bun.build({
	entrypoints: ['src/cli/index.ts'],
	outdir: 'dist',
	target: 'bun',
	minify: false,
	define: {
		__GSPEND_VERSION__: JSON.stringify(pkgJson.version),
	},
	plugins: [
		{
			name: 'stub-react-devtools',
			setup(build) {
				build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
					path: 'react-devtools-core',
					namespace: 'stub',
				}));
				build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
					contents: 'export default { initialize() {}, connectToDevTools() {} }',
					loader: 'js',
				}));
			},
		},
	],
});

if (!result.success) {
	console.error('Bundle step failed:');
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

// Verify version was injected into the bundle
const bundle = await Bun.file('dist/index.js').text();
if (!bundle.includes(JSON.stringify(pkgJson.version))) {
	console.error(`Version ${pkgJson.version} not found in bundle — define injection failed`);
	process.exit(1);
}

console.log(`Bundle created: dist/index.js (v${pkgJson.version})`);

// Step 2: Compile the bundle to a standalone binary
const compileArgs = ['bun', 'build', 'dist/index.js', '--compile', '--outfile', 'dist/gspend'];
if (target) {
	compileArgs.push(`--target=${target}`);
}

const compile = Bun.spawnSync(compileArgs);
if (compile.exitCode !== 0) {
	console.error('Compile step failed:');
	console.error(compile.stderr.toString());
	process.exit(1);
}

console.log(`Binary created: dist/gspend${target ? ` (${target})` : ''}`);
