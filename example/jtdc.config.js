const {pascalCase} = require ('change-case-all');
const {JtdNodeType} = require('@jtdc/types');

// https://smikhalevski.github.io/jtdc/interfaces/IModulesCompilerOptions.html
module.exports = {
  validatorsRendered: true,
  typeGuardsRendered: true,

  // This is the default value
  validatorDialectFactory: require('@jtdc/jtd-dialect').validatorDialectFactory,

  runtimeVarName: '_',

  // Add the "I" prefix to the interface names
  renameType: (name, node) => (node.nodeType === JtdNodeType.OBJECT ? 'I' : '') + pascalCase(name),

  // Use explicit numeric enum values
  rewriteEnumValue: (value, node) => node.values.indexOf(value),
};
