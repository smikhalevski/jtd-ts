import {program} from 'commander';
import {compileModules, createImportResolver, IModulesCompilerOptions, stripExtension} from '@jtdc/compiler';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import {validatorDialectFactory} from '@jtdc/jtd-dialect';

const CONFIG_PATH = 'jtdc.config.js';

const packageJson = require('../package.json');

program.name('jtdc');
program.version(packageJson.version);
program.description(packageJson.description);

program.requiredOption('-i, --includes <path...>', 'file paths of type definitions');
program.requiredOption('-o, --outDir <dir>', 'an output folder for all emitted files');
program.option('-c, --config <path>', 'config path', CONFIG_PATH);
program.option('-d, --rootDir <dir>', 'the root folder within your source files', '.');
program.option('-v, --validators', 'render validators');
program.option('-g, --typeGuards', 'render validators and type guards');

const params = program.parse(process.argv).opts();

const cwd = process.cwd();

const outDir = path.resolve(cwd, params.outDir);
const rootDir = path.resolve(cwd, params.rootDir);
const configPath = path.resolve(cwd, params.config);

const config: IModulesCompilerOptions<unknown, unknown> = {
  importResolver: createImportResolver(path),
  validatorDialectFactory,
};

if (fs.existsSync(configPath)) {
  Object.assign(config, require(configPath));
} else if (params.config !== CONFIG_PATH) {
  console.log('error: Config not found ' + configPath);
  process.exit(1);
}

config.validatorsRendered ||= params.validators || params.typeGuards;
config.typeGuardsRendered ||= params.typeGuards;

const filePaths = new Array<string>().concat(...params.includes.map((include: string) => glob.sync(include, {cwd: rootDir})));

if (!filePaths.length) {
  console.log('error: No files to compile');
  process.exit(1);
}

const jtdModules = Object.create(null);

for (const filePath of filePaths) {
  jtdModules[path.join(outDir, stripExtension(filePath) + '.ts')] = require(path.resolve(rootDir, filePath));
}

let modules;
try {
  modules = compileModules(jtdModules, config);
} catch (error: any) {
  console.log('error: ' + error.message);
  process.exit(1);
}

for (const module of modules) {
  fs.mkdirSync(path.dirname(module.filePath), {recursive: true});
  fs.writeFileSync(module.filePath, module.source + '\n', {encoding: 'utf8'});
}
