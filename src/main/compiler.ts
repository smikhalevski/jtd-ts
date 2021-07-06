import {
  compileValidatorModuleProlog,
  compileValidators,
  IValidatorCompilationResult,
  IValidatorOptions,
} from './validator';
import {parseJtdDefinitions, parseJtdRoot} from './jtd-ast';
import {IJtdMap, IJtdRoot} from './jtd-types';
import {compileTsFromJtdDefinitions, IJtdTsCompilationResult, IJtdTsOptions, ITsJtdMetadata} from './jtd-ts';

const VAR_RUNTIME = '$validatorRuntime';

export interface IValidatorModuleOptions<Metadata> extends Partial<IValidatorOptions<Metadata>> {
}

export function compileValidatorModule<Metadata extends ITsJtdMetadata>(definitions: IJtdMap<Metadata>, options?: IValidatorModuleOptions<Metadata>): IValidatorCompilationResult;

export function compileValidatorModule<Metadata extends ITsJtdMetadata>(ref: string, jtdRoot: IJtdRoot<Metadata>, options?: IValidatorModuleOptions<Metadata>): IValidatorCompilationResult;

export function compileValidatorModule(): IValidatorCompilationResult {
  let result;

  if (typeof arguments[0] === 'string') {
    result = compileValidators(parseJtdRoot(arguments[0], arguments[1]), arguments[2]);
  } else {
    result = compileValidators(parseJtdDefinitions(arguments[0]), arguments[1]);
  }

  return {
    source: `import ${VAR_RUNTIME} from "jtd-ts/lib/validator/runtime";`
        + compileValidatorModuleProlog(VAR_RUNTIME)
        + result.source,
    importMap: result.importMap,
  };
}

export interface IJtdTsModuleOptions<Metadata> extends Partial<IJtdTsOptions<Metadata>> {
}

export function compileJtdTsModule<Metadata extends ITsJtdMetadata>(definitions: IJtdMap<Metadata>, options?: IJtdTsModuleOptions<Metadata>): IJtdTsCompilationResult;

export function compileJtdTsModule<Metadata extends ITsJtdMetadata>(ref: string, jtdRoot: IJtdRoot<Metadata>, options?: IJtdTsModuleOptions<Metadata>): IJtdTsCompilationResult;

export function compileJtdTsModule(): IJtdTsCompilationResult {
  if (typeof arguments[0] === 'string') {
    return compileTsFromJtdDefinitions(parseJtdRoot<ITsJtdMetadata>(arguments[0], arguments[1]), arguments[2]);
  } else {
    return compileTsFromJtdDefinitions(parseJtdDefinitions<ITsJtdMetadata>(arguments[0]), arguments[1]);
  }
}

export interface IDependentJtdTsModulesOptions<Metadata> extends Omit<IValidatorModuleOptions<Metadata>, 'resolveRef'>, Omit<IJtdTsModuleOptions<Metadata>, 'resolveRef'> {
}

export function compileDependentJtdTsModules<Metadata extends ITsJtdMetadata>(modules: Record<string, IJtdMap<Metadata>>, options?: IDependentJtdTsModulesOptions<Metadata>): Record<string, string> {

  const fileMap: Record<string, string> = {};

  const resultsMap: Record<string, IJtdTsCompilationResult> = {};
  const typeExports: Record<string, [file: string, type: string]> = {};
  
  for (const file in modules) {
    const result = resultsMap[file] = compileJtdTsModule(modules[file], options);
    result.exportsMap.forEach((type, ref) => typeExports[ref] ||= [file, type]);
  }

  for (const file in modules) {
    resultsMap[file] = compileJtdTsModule(modules[file], {
      ...options,
      resolveRef: (ref) => {
        const typeExport = typeExports[ref];

        if (!typeExport) {
          throw new Error('Missing reference: ' + ref);
        }

        return typeExport[1];
      }
    });
  }

  // Populate type files
  for (const file in modules) {
    const typeImports: Record<string, Set<string>> = {};
    const result = resultsMap[file];

    result.importMap.forEach((type, ref) => {
      const typeExport = typeExports[ref];

      if (!typeExport) {
        throw new Error('Missing reference: ' + ref);
      }

      const importSet = typeImports[typeExport[0]] ||= new Set();
      importSet.add(typeExport[1]);
    });

    let source = '';

    for (const file in typeImports) {
      source += `import {${Array.from(typeImports[file]).join(',')}} from ${JSON.stringify(file)};`;
    }

    fileMap[file] = source + result.source;
  }

  // Populate validator files
  for (const file in modules) {
    const typeImports: Record<string, Set<string>> = {};

    const result = compileValidatorModule(modules[file], {
      ...options,

      resolveRef: (ref) => {
        const typeExport = typeExports[ref];

        if (!typeExport) {
          throw new Error('Missing reference: ' + ref);
        }

        const importSet = typeImports[typeExport[0]] ||= new Set();
        importSet.add(typeExport[1]);
        return typeExport[1];
      },
    });

    let source = '';

    for (const file in typeImports) {
      source += `import {${Array.from(typeImports[file]).join(',')}} from ${JSON.stringify(file)};`;
    }

    const i = file.lastIndexOf('.');
    const validatorsFile = i === -1 ? file + '-validators' : file.substr(0, i) + '-validators' + file.substr(i);

    fileMap[validatorsFile] = source + result.source;
  }

  return fileMap;
}
