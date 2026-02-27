const fs = require('fs');
const path = require('path');

function extractObjectLiteral(source, constName) {
  const startToken = `const ${constName} =`;
  const start = source.indexOf(startToken);
  if (start === -1) {
    throw new Error(`Could not find declaration: ${constName}`);
  }

  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) {
    throw new Error(`Could not find object body for: ${constName}`);
  }

  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;

    if (depth === 0) {
      const body = source.slice(braceStart, i + 1);
      return body;
    }
  }

  throw new Error(`Could not parse object body for: ${constName}`);
}

function loadLogicObjects() {
  const htmlPath = path.resolve(__dirname, '..', 'workspace', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const script = html.split('<script>')[1]?.split('</script>')[0];
  if (!script) {
    throw new Error('Could not locate <script> block in workspace/index.html');
  }

  const simLiteral = extractObjectLiteral(script, 'simulationLogic');
  const renderLiteral = extractObjectLiteral(script, 'renderLogic');

  const simulationLogic = Function(`return (${simLiteral});`)();
  const renderLogic = Function(`return (${renderLiteral});`)();

  return { simulationLogic, renderLogic };
}

module.exports = { loadLogicObjects, extractObjectLiteral };
