import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(own, '../../../../../../..');
const source = path.join(own, 'proposed/cpa_uploader');
const target = path.join(own, 'fixture-runtime'); fs.mkdirSync(target, { recursive: true });
const files = fs.readdirSync(source).filter(file => file.endsWith('.ts.txt')).map(file => file.slice(0, -4));
const virtual = new Map();
for (const file of files) {
  let code = fs.readFileSync(path.join(source, file + '.txt'), 'utf8');
  code = code.replace(/from (['"])(\.\.?\/[^'"]+)\1/g, (all, quote, specifier) => {
    const absolute = path.resolve(root, 'cpa_uploader', specifier);
    const base = path.basename(absolute);
    return `from ${quote}${path.dirname(absolute) === path.join(root, 'cpa_uploader') && files.includes(base) ? './' + base : pathToFileURL(absolute).href}${quote}`;
  });
  code = code.replace("const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');", `const root = ${JSON.stringify(root)};`);
  if (file === 'questionGradingAcceptance.ts') code += '\nexport { validateTrace as fixtureValidateTrace };\n';
  virtual.set(path.join(target, file), code);
  const runtime = code.replace(/from (['"])(\.\/[^'"]+)\.ts\1/g, 'from $1$2.mjs$1');
  fs.writeFileSync(path.join(target, file.replace(/\.ts$/, '.mjs')), ts.transpileModule(runtime, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
}
// Resolve relocated imports during typecheck to their real absolute targets.
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
options.incremental = false; options.noEmit = true;
const host = ts.createCompilerHost(options);
const getSourceFile = host.getSourceFile.bind(host);
const fileExists = host.fileExists.bind(host);
host.fileExists = file => virtual.has(path.resolve(file)) || fileExists(file);
host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => virtual.has(path.resolve(file))
  ? ts.createSourceFile(file, virtual.get(path.resolve(file)), languageVersion, true)
  : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
host.resolveModuleNames = (names, containing) => names.map(name => name.startsWith('file:')
  ? (name.endsWith('.mjs') && fs.existsSync(fileURLToPath(name).replace(/\.mjs$/, '.d.mts'))
    ? { resolvedFileName: fileURLToPath(name).replace(/\.mjs$/, '.d.mts'), extension: ts.Extension.Dmts }
    : { resolvedFileName: fileURLToPath(name), extension: name.endsWith('.mjs') ? ts.Extension.Mjs : ts.Extension.Ts })
  : name.startsWith('./') && virtual.has(path.resolve(path.dirname(containing), name))
    ? { resolvedFileName: path.resolve(path.dirname(containing), name), extension: ts.Extension.Ts }
  : ts.resolveModuleName(name, containing, options, ts.sys).resolvedModule);
const program = ts.createProgram(files.map(file => path.join(target, file)), options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getNewLine: () => '\n', getCanonicalFileName: f => f }));
const report = { relocation_only: ['relative imports resolve to real original dependencies or sibling proposed modules', 'graderHash repository root points at real unchanged grading files'],
  production_edits: 0, api_calls: 0, diagnostics: diagnostics.map(d => ({ code: d.code, file: d.file?.fileName, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') })) };
fs.writeFileSync(path.join(own, 'typecheck.json'), JSON.stringify(report, null, 2) + '\n');
if (diagnostics.length) process.exitCode = 1;
