const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function createDomStub() {
  const noop = () => {};
  const createElement = () => ({
    addEventListener: noop,
    removeEventListener: noop,
    style: {},
    textContent: '',
    value: '1',
    checked: false,
    files: [],
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    querySelectorAll: () => [],
    querySelector: () => createElement(),
    appendChild: noop,
    removeChild: noop,
    click: noop,
    focus: noop
  });

  const canvasContext = {
    clearRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    fillText: noop,
    strokeText: noop,
    setLineDash: noop,
    save: noop,
    restore: noop,
    measureText: () => ({ width: 10 }),
    closePath: noop,
    fillRect: noop,
    strokeRect: noop,
    drawImage: noop
  };

  const canvas = createElement();
  canvas.getContext = () => canvasContext;
  canvas.width = 800;
  canvas.height = 600;

  return { createElement, canvas, noop };
}

function loadAppContext() {
  const html = fs.readFileSync('workspace/index.html', 'utf8');
  const script = html.split('<script>')[1]?.split('</script>')[0];
  if (!script) throw new Error('script block not found');

  const { createElement, canvas, noop } = createDomStub();
  const context = {
    console,
    setTimeout: noop,
    clearTimeout: noop,
    setInterval: noop,
    clearInterval: noop,
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
    Image: function Image() { this.onload = null; },
    performance: { now: () => 0 },
    alert: noop,
    addEventListener: noop,
    removeEventListener: noop,
    document: {
      getElementById: (id) => (id === 'canvas' ? canvas : createElement()),
      querySelectorAll: () => [],
      querySelector: () => createElement(),
      addEventListener: noop,
      createElement,
      body: createElement()
    }
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(script, context);
  return context;
}

test('simEngine.init marks SyncArea occupied when AMR starts inside area', () => {
  const context = loadAppContext();

  const result = vm.runInContext(`(() => {
    state.nodes.clear();
    state.segments.clear();
    state.adjacency.clear();
    state.loopSegments.clear();
    state.homeSegments.clear();
    state.loopOrder = [];
    state.syncAreas = [];
    state.nodeCounter = 0;
    state.segCounter = 0;
    state.syncAreaCounter = 0;

    const wp = graphManager.addNode('waypoint', 300, 200, 'WP');
    const pickup = graphManager.addNode('pickup', 180, 200, 'Pickup A');
    const home = graphManager.addNode('home', 300, 200, 'Home A');

    graphManager.addLoopSegment(wp.id, pickup.id);
    graphManager.addLoopSegment(pickup.id, wp.id);
    graphManager.addHomeSegment(wp.id, home.id);

    state.syncAreas.push({
      id: 'sa1',
      points: [{ x: 250, y: 150 }, { x: 350, y: 150 }, { x: 350, y: 250 }, { x: 250, y: 250 }],
      occupantAmrId: null
    });

    state.config.amrCount = 1;
    simEngine.init();

    return {
      amrId: state.amrs[0].id,
      occupantAmrId: state.syncAreas[0].occupantAmrId
    };
  })()`, context);

  assert.equal(result.occupantAmrId, result.amrId);
});
