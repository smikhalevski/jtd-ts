import {IJtdMap} from './jtd-types';
import {
  compileTsFromJtdDefinitions,
  IJtdTsOptions,
  IJtdTsRefRenameOptions,
  jtdTsOptions,
  renameRef,
} from './jtd-ts';
import {parseJtdDefinitions} from './jtd-ast';
import {JtdNode} from './jtd-ast-types';
import {compileValidators, IValidatorOptions, jtdValidatorOptions} from './validator/jtd-validator';

export interface IJtdTsModulesOptions<M> extends IJtdTsOptions<M>, IValidatorOptions<M> {

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

export function compileJtdTsModules<M extends ITsJtdMetadata>(modules: Record<string, IJtdMap<M>>, options?: IJtdTsModulesOptions<M>): Record<string, string> {
  const tsModules: Record<string, string> = Object.create(null);

  interface IParsedModule<M> {
    uri: string;
    definitions: IJtdNodeMap<any>;
    tsExports: Record<string, ITsExport<M>>;
  }

  const parsedModules: Array<IParsedModule<M>> = [];

  const opts = Object.assign({}, jtdValidatorOptions, jtdTsOptions, options);

  const resolveRef = opts.resolveRef;

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
    if (opts.emitsValidators) {
      source += `import {runtime as r, Validator as ${TYPE_VALIDATOR}} from "../validator/runtime";`
          + compileValidatorModuleProlog(VAR_RUNTIME);
    }

    // Module types
    const typeSource = compileTsFromJtdDefinitions(definitions, opts);

    // Cross-module type an validator imports
    for (const [uri, tsImport] of Object.entries(tsImports)) {

      // Import types
      source += 'import {'
          + Object.values(tsImport).map((tsExport) => tsExport.name).join(',');

      // Import validators
      if (opts.emitsValidators) {
        source += ',' + Object.entries(tsImport).map(([ref, tsExport]) => opts.renameValidator(ref, tsExport.node)).join(',');
      }
      source += `} from ${JSON.stringify(uri)};`;
    }

    // Type source
    source += typeSource;

    // Validator and checker source
    if (opts.emitsValidators) {
      opts.resolveRef = (ref) => tsExports[ref].name;
      source += compileValidators(definitions, opts);
    }

    if (opts.alterSource) {
      source = opts.alterSource(source, uri);
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
function getTsExports<M>(definitions: IJtdNodeMap<M>, options: Required<IJtdTsRefRenameOptions<M>>): Record<string, ITsExport<M>> {
  const exports: Record<string, ITsExport<M>> = Object.create(null);

  for (const [ref, node] of Object.entries(definitions)) {
    exports[ref] = {
      name: renameRef(ref, node, options),
      node,
    };
  }
  return exports;
}
