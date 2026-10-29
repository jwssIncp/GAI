const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'gai-frontend/node_modules/typescript'));
const out = path.join(__dirname, 'evidencias');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
const controls = [], modules = [];
for (const name of ['inventario-controles', 'inventario-frontend']) {
  const original = path.join(out, name + '.json'), saved = path.join(out, name + '-inicial.json');
  if (fs.existsSync(original) && !fs.existsSync(saved)) fs.copyFileSync(original, saved);
}
for (const file of walk(path.join(root, 'gai-frontend/src'))) {
  if (!/\.(tsx|css)$/.test(file) || /\.test\.tsx$/.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8'), relative = path.relative(root, file).replaceAll('\\', '/');
  const entry = { path: relative, lines: source.split('\n').length, controls: 0,
    literalColors: [...new Set(source.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) ?? [])],
    semanticColors: (source.match(/var\(--|(?:bg|text|border)-(?:primary|muted|card|foreground|background|destructive|success|warning|info)/g) ?? []).length,
    rawTables: (source.match(/<table\b/g) ?? []).length };
  modules.push(entry);
  if (!file.endsWith('.tsx')) continue;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      const interactiveTag = /^(button|Button|a|Link|NavLink|input|Input|IconInput|select|textarea|form|FileUpload|MoneyInput|DateInput|DropdownMenu\.(Item|Trigger|RadioItem)|DialogPrimitive\.(Close|Trigger)|Dialog\.Close|HelpPopover|summary)$/.test(tag);
      if (interactiveTag || node.attributes.properties.some(a => ts.isJsxAttribute(a) && ['onClick', 'onKeyDown', 'onSelect'].includes(a.name.getText(ast)))) {
        const line = ast.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const attrs = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(a => [a.name.getText(ast), a.initializer?.getText(ast) ?? 'true']));
        let label = attrs['aria-label'] ?? attrs.title ?? attrs.placeholder ?? '';
        if (!label && ts.isJsxElement(node.parent)) label = node.parent.children.filter(ts.isJsxText).map(n => n.text.trim()).filter(Boolean).join(' ').slice(0, 150);
        const wrapper = node.parent?.parent?.getText(ast).slice(0, 1000) ?? '';
        let owner = node.parent;
        while (owner.parent && !ts.isFunctionDeclaration(owner) && !ts.isArrowFunction(owner) && !ts.isFunctionExpression(owner)) owner = owner.parent;
        const ownerSource = owner.getText(ast);
        controls.push({ id: `${relative}:${line}:${controls.length + 1}`, path: relative, line, tag, label,
          attributes: attrs, surrounding: wrapper.slice(0, 650),
          staticSignals: {
            connection: attrs.onClick ?? attrs.onSelect ?? attrs.onSubmit ?? attrs.onChange ?? attrs.to ?? attrs.href ?? (attrs.type === '"submit"' || attrs.type === "'submit'" ? 'Form submission' : 'Inherited or declarative; review wrapper'),
            permissionReferences: [...new Set(ownerSource.match(/(?:[a-z-]+):(?:read|write|create|update|delete|edit|approve|reopen|export|templates)/g) ?? [])],
            hasFeedbackReference: /toast\(|role=["'](?:alert|status)|setError|formState|onError|ErrorState/.test(ownerSource),
            hasPendingReference: /isPending|isSubmitting|loading=|disabled=|busy=/.test(ownerSource),
            hasRefreshReference: /invalidateQueries|refetch|onSuccess/.test(ownerSource),
            nativeKeyboardControl: /^(button|Button|a|Link|NavLink|input|Input|IconInput|select|textarea|summary|DropdownMenu\.)/.test(tag),
            explicitKeyboardHandler: Boolean(attrs.onKeyDown),
          },
          evidence: 'Inspeção estática; execução individual ainda não comprovada',
          needsReview: /^(button|Button)$/.test(tag) && !attrs.onClick && !attrs.type && !/Trigger|Close|<form|asChild/.test(wrapper) });
        entry.controls++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'inventario-controles.json'), JSON.stringify(controls, null, 2));
fs.writeFileSync(path.join(out, 'inventario-frontend.json'), JSON.stringify(modules, null, 2));
console.log(JSON.stringify({ files: modules.length, controls: controls.length, literalColors: modules.filter(e => e.literalColors.length).map(e => ({ path: e.path, colors: e.literalColors })), review: controls.filter(e => e.needsReview).map(({ path, line, label }) => ({ path, line, label })) }, null, 2));
