const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '..', 'workspace', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const script = html.split('<script>')[1]?.split('</script>')[0];

if (!script) {
  throw new Error('Could not locate <script> block in workspace/index.html');
}

Function(script);
console.log('syntax-ok');
