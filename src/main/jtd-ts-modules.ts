import {IJtdMap} from './jtd-types';
import {
  compileTsFromJtdDefinitions,
  IJtdTsOptions,
  IJtdTsRenameOptions,
  ITsJtdMetadata,
  jtdTsOptions,
  renameRef,
} from './jtd-ts';
import {parseJtdDefinitions} from './jtd-ast';
import {IJtdNodeMap, JtdNode} from './jtd-ast-types';
import {compileValidatorModuleProlog, compileValidators, IValidatorOptions, jtdValidatorOptions} from './validator';
import {TYPE_VALIDATOR, VAR_RUNTIME} from './validator/runtime-naming';

export interface IJtdTsModulesOptions<Metadata> extends Partial<Omit<IJtdTsOptions<Metadata> & IValidatorOptions<Metadata>, 'resolveRef'>> {

  /**
   * If set to `true` then validator functions are emitted along with type.
   *
   * @default false
   */
  emitsValidators?: boolean;

  /**
   * Arbitrary TS source prepended to modules after imports.
   */
  prependedSource?: string;
}

export function compileJtdTsModules<Metadata extends ITsJtdMetadata>(modules: Record<string, IJtdMap<Metadata>>, options?: IJtdTsModulesOptions<Metadata>): Record<string, string> {
  const tsModules: Record<string, string> = Object.create(null);

  const parsedModules: Array<{ uri: string, definitions: IJtdNodeMap<Metadata>, tsExports: Record<string, ITsExport<Metadata>> }> = [];

  const opts = Object.assign({}, jtdValidatorOptions, jtdTsOptions, options);

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

    const tsImports: Record<string, Record<string, ITsExport<Metadata>>> = Object.create(null);

    // Cross-module ref resolver
    opts.resolveRef = (ref) => {
      for (const {uri, tsExports} of parsedModules) {
        if (ref in tsExports) {

          const tsExport = tsExports[ref];
          const tsImport = tsImports[uri] ||= {};

          tsImport[ref] = tsExport;

          return tsExport.name;
        }
      }
      throw new Error('Unresolved reference: ' + ref);
    };

    let source = opts.prependedSource || '';

    // jtdc import of validator runtime
    if (opts.emitsValidators) {
      source += `import ${VAR_RUNTIME}, {Validator as ${TYPE_VALIDATOR}} from "../validator/runtime";`
          + compileValidatorModuleProlog(VAR_RUNTIME);
    }

    // Module types
    const typeSource = compileTsFromJtdDefinitions(definitions, opts);

    // Cross-module type an validator imports
    for (const [uri, tsImport] of Object.entries(tsImports)) {

      // Import types
      source += 'import {' +
          Object.values(tsImport).map((tsExport) => tsExport.name).join(',');

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

    tsModules[uri] = source;
  }

  return tsModules;
}

interface ITsExport<Metadata> {

  /**
   * The TS type name.
   */
  name: string;

  /**
   * The node that describes the type.
   */
  node: JtdNode<Metadata>;
}

/**
 * Returns map from ref to a TS type name.
 */
function getTsExports<Metadata>(definitions: IJtdNodeMap<Metadata>, options: IJtdTsRenameOptions<Metadata>): Record<string, ITsExport<Metadata>> {
  const exports: Record<string, ITsExport<Metadata>> = Object.create(null);

  for (const [ref, node] of Object.entries(definitions)) {
    exports[ref] = {
      name: renameRef(ref, node, options),
      node,
    };
  }
  return exports;
}
