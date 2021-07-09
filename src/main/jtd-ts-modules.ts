import {compileTsFromJtdDefinitions, IJtdTsOptions, IJtdTsRefRenameOptions, jtdTsOptions, renameRef} from './jtd-ts';
import {parseJtdDefinitions} from './jtd-ast';
import {JtdNode} from './jtd-ast-types';
import {compileValidators, IValidatorCompilerOptions, jtdValidatorOptions} from './validator';
import {IJtd} from './jtd-types';

export interface IJtdTsModulesOptions<M> extends IJtdTsOptions<M>, IValidatorCompilerOptions<M> {

  /**
   * If set to `true` then validator functions are emitted along with type.
   *
   * @default false
   */
  emitsValidators?: boolean;

  /**
   * Callback that additionally modifies the generated TS source. Use this to prepend checker imports or add licence
   * info to each file.
   */
  alterSource?: (source: string, uri: string) => string;
}

export function compileJtdTsModules<M>(modules: Record<string, Record<string, IJtd<M>>>, options?: IJtdTsModulesOptions<M>): Record<string, string> {
  const tsModules: Record<string, string> = Object.create(null);

  interface IParsedModule<M> {
    uri: string;
    definitions: Record<string, JtdNode<M>>;
    tsExports: Record<string, ITsExport<M>>;
  }

  const parsedModules: Array<IParsedModule<M>> = [];

  const opts = Object.assign({}, jtdValidatorOptions, jtdTsOptions, options);

  const {
    checkerRuntimeVar,
    validatorRuntimeVar,
    checkerCompiler: {runtimeModulePath},
    resolveRef,
    emitsValidators,
    alterSource,
    renameValidator,
  } = opts;

  // Parse AST and extract exports
  for (const uri of Object.keys(modules)) {
    const definitions = parseJtdDefinitions(modules[uri]);

    parsedModules.push({
      uri,
      definitions,
      tsExports: getTsExports(definitions, opts),
    });
  }

  for (const {uri, definitions, tsExports} of parsedModules) {

    const tsImports: Record<string, Record<string, ITsExport<M>>> = Object.create(null);

    // Cross-module ref resolver
    opts.resolveRef = (ref, node) => {
      for (const {uri, tsExports} of parsedModules) {
        if (ref in tsExports) {

          const tsExport = tsExports[ref];
          const tsImport = tsImports[uri] ||= {};

          tsImport[ref] = tsExport;

          return tsExport.name;
        }
      }
      return resolveRef(ref, node);
    };

    let source = '';

    // jtdc import of validator runtime
    if (emitsValidators) {
      source += `import ${checkerRuntimeVar} from "${runtimeModulePath}";`
          + `import ${validatorRuntimeVar},{Validator} from "jtdc/lib/validator/runtime";`;
    }

    // Module types
    const typeSource = compileTsFromJtdDefinitions(definitions, opts);

    // Cross-module type an validator imports
    for (const [uri, tsImport] of Object.entries(tsImports)) {

      // Import types
      source += 'import {'
          + Object.values(tsImport).map((tsExport) => tsExport.name).join(',');

      // Import validators
      if (emitsValidators) {
        source += ',' + Object.entries(tsImport).map(([ref, tsExport]) => renameValidator(ref, tsExport.node)).join(',');
      }
      source += `} from ${JSON.stringify(uri)};`;
    }

    // Type source
    source += typeSource;

    // Validator and checker source
    if (emitsValidators) {
      opts.resolveRef = (ref) => tsExports[ref].name;
      source += compileValidators(definitions, opts);
    }

    if (alterSource) {
      source = alterSource(source, uri);
    }

    tsModules[uri] = source;
  }

  return tsModules;
}

interface ITsExport<M> {

  /**
   * The TS type name.
   */
  name: string;

  /**
   * The node that describes the type.
   */
  node: JtdNode<M>;
}

/**
 * Returns map from ref to a TS type name.
 */
function getTsExports<M>(definitions: Record<string, JtdNode<M>>, options: Required<IJtdTsRefRenameOptions<M>>): Record<string, ITsExport<M>> {
  const exports: Record<string, ITsExport<M>> = Object.create(null);

  for (const [ref, node] of Object.entries(definitions)) {
    exports[ref] = {
      name: renameRef(ref, node, options),
      node,
    };
  }
  return exports;
}
