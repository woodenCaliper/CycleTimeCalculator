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


test('pointInPolygon treats boundary points as inside SyncArea', () => {
  const context = loadAppContext();

  const onEdge = vm.runInContext(`(() => {
    const poly = [{ x: 250, y: 150 }, { x: 350, y: 150 }, { x: 350, y: 250 }, { x: 250, y: 250 }];
    return pointInPolygon(300, 150, poly);
  })()`, context);

  assert.equal(onEdge, true);
});


test('simEngine.update updates AMRs inside SyncArea before outside entrants', () => {
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

    const left = graphManager.addNode('waypoint', 160, 200, 'Left');
    const center = graphManager.addNode('waypoint', 200, 200, 'Center');
    const right = graphManager.addNode('waypoint', 260, 200, 'Right');
    graphManager.addLoopSegment(left.id, center.id);
    graphManager.addLoopSegment(center.id, left.id);
    graphManager.addLoopSegment(center.id, right.id);
    graphManager.addLoopSegment(right.id, center.id);

    state.syncAreas.push({
      id: 'sa1',
      points: [{ x: 170, y: 170 }, { x: 230, y: 170 }, { x: 230, y: 230 }, { x: 170, y: 230 }],
      occupantAmrId: 'amr_1'
    });

    const amrInside = simulationLogic.createInitialAmr(center, 0);
    amrInside.id = 'amr_1';
    amrInside.state = 'moving_to_dropoff';
    amrInside.currentNodeId = center.id;
    amrInside.currentPath = [center.id, right.id];
    amrInside.pathIndex = 1;
    amrInside.x = 200;
    amrInside.y = 200;

    const amrOutside = simulationLogic.createInitialAmr(left, 1);
    amrOutside.id = 'amr_2';
    amrOutside.state = 'moving_to_dropoff';
    amrOutside.currentNodeId = left.id;
    amrOutside.currentPath = [left.id, center.id];
    amrOutside.pathIndex = 1;
    amrOutside.x = 160;
    amrOutside.y = 200;

    state.amrs = [amrOutside, amrInside];
    state.config.amrSpeed = 1;
    state.config.scale = 0.1;

    simEngine.update(4);

    return {
      outsideX: state.amrs[0].x,
      outsideState: state.amrs[0].state,
      occupant: state.syncAreas[0].occupantAmrId
    };
  })()`, context);

  assert.equal(result.outsideX > 160, true);
});


test('two SyncAreas around pickup and relay waypoint do not deadlock delivery flow', () => {
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

    const pickup = graphManager.addNode('pickup', 100, 230, 'Pickup A');
    const relay = graphManager.addNode('waypoint', 320, 210, 'Relay');
    const dropoff = graphManager.addNode('dropoff', 540, 210, 'DropOff A');
    graphManager.addLoopSegment(pickup.id, relay.id);
    graphManager.addLoopSegment(relay.id, pickup.id);
    graphManager.addLoopSegment(relay.id, dropoff.id);
    graphManager.addLoopSegment(dropoff.id, relay.id);

    const homes = [
      graphManager.addNode('home', 220, 110, 'Home A'),
      graphManager.addNode('home', 380, 90, 'Home B'),
      graphManager.addNode('home', 280, 320, 'Home C'),
      graphManager.addNode('home', 420, 320, 'Home D')
    ];
    homes.forEach(home => graphManager.addHomeSegment(relay.id, home.id));

    state.syncAreas.push({
      id: 'left',
      points: [{ x: 35, y: 160 }, { x: 175, y: 160 }, { x: 190, y: 300 }, { x: 20, y: 300 }],
      occupantAmrId: null
    });
    state.syncAreas.push({
      id: 'center',
      points: [{ x: 250, y: 170 }, { x: 400, y: 170 }, { x: 400, y: 260 }, { x: 250, y: 260 }],
      occupantAmrId: null
    });

    state.config.amrCount = 4;
    state.config.amrSpeed = 1;
    state.config.scale = 0.1;
    state.config.dockingTime = 30;
    state.config.releaseTime = 20;
    state.config.pickupSupplyInterval = 20;

    simEngine.init();
    for (let i = 0; i < 3000; i++) simEngine.update(0.1);

    return {
      deliveries: state.totalDeliveries,
      amrStates: state.amrs.map(amr => amr.state)
    };
  })()`, context);

  assert.equal(result.deliveries > 0, true);
});


test('blocked moving_to_pickup AMR does not yield home without mutual SyncArea deadlock', () => {
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

    const pickup = graphManager.addNode('pickup', 100, 200, 'Pickup');
    const relay = graphManager.addNode('waypoint', 300, 200, 'Relay');
    graphManager.addLoopSegment(relay.id, pickup.id);
    graphManager.addLoopSegment(pickup.id, relay.id);

    state.syncAreas.push({
      id: 'pickupArea',
      points: [{ x: 60, y: 160 }, { x: 140, y: 160 }, { x: 140, y: 240 }, { x: 60, y: 240 }],
      occupantAmrId: 'amr_2'
    });
    state.syncAreas.push({
      id: 'relayArea',
      points: [{ x: 250, y: 160 }, { x: 350, y: 160 }, { x: 350, y: 240 }, { x: 250, y: 240 }],
      occupantAmrId: 'amr_1'
    });

    const amr1 = simulationLogic.createInitialAmr(relay, 0);
    amr1.id = 'amr_1';
    amr1.state = 'moving_to_pickup';
    amr1.currentNodeId = relay.id;
    amr1.currentPath = [relay.id, pickup.id];
    amr1.pathIndex = 1;
    amr1.x = 300;
    amr1.y = 200;
    amr1.assignedPickup = pickup.id;

    const amr2 = simulationLogic.createInitialAmr(pickup, 1);
    amr2.id = 'amr_2';
    amr2.state = 'docking';
    amr2.currentNodeId = pickup.id;
    amr2.currentPath = null;
    amr2.pathIndex = 0;
    amr2.x = 100;
    amr2.y = 200;

    state.amrs = [amr1, amr2];
    state.config.amrSpeed = 1;
    state.config.scale = 0.1;

    for (let i = 0; i < 50; i++) simEngine.update(0.1);

    return {
      state: state.amrs[0].state,
      assignedPickup: state.amrs[0].assignedPickup
    };
  })()`, context);

  assert.equal(result.state, 'moving_to_pickup');
  assert.notEqual(result.assignedPickup, null);
});
