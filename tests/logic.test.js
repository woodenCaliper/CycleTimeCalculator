const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLogicObjects } = require('../scripts/extract-logic');

const { simulationLogic, renderLogic } = loadLogicObjects();

test('simulationLogic.formatTime formats HH:MM:SS', () => {
  assert.equal(simulationLogic.formatTime(0), '00:00:00');
  assert.equal(simulationLogic.formatTime(3661), '01:01:01');
});

test('simulationLogic.calculateSummaryStats returns placeholder for no records', () => {
  const stats = simulationLogic.calculateSummaryStats(120, 0, []);
  assert.deepEqual(stats, {
    avgCtText: '-- 秒',
    throughputText: '-- 回/h'
  });
});

test('simulationLogic.calculateSummaryStats computes average and throughput', () => {
  const records = [{ totalCycleTime: 100 }, { totalCycleTime: 140 }];
  const stats = simulationLogic.calculateSummaryStats(300, 5, records);

  assert.equal(stats.avgCtText, '120.0 秒');
  assert.equal(stats.throughputText, '60.0 回/h');
});

test('simulationLogic.calculateMoveState returns reached=true when target can be reached in one step', () => {
  const amr = { x: 0, y: 0, direction: 1.2 };
  const target = { x: 3, y: 4 };

  const moveState = simulationLogic.calculateMoveState(amr, target, 5);
  assert.equal(moveState.reached, true);
  assert.equal(moveState.nextX, 3);
  assert.equal(moveState.nextY, 4);
  assert.equal(moveState.direction, 1.2);
});

test('simulationLogic.calculateMoveState returns intermediate point when not reached', () => {
  const amr = { x: 0, y: 0, direction: 0 };
  const target = { x: 3, y: 4 };

  const moveState = simulationLogic.calculateMoveState(amr, target, 2.5);
  assert.equal(moveState.reached, false);
  assert.equal(moveState.nextX, 1.5);
  assert.equal(moveState.nextY, 2);
  assert.equal(moveState.direction, Math.atan2(4, 3));
});

test('renderLogic.getSegmentStyle resolves styles by priority', () => {
  assert.deepEqual(renderLogic.getSegmentStyle({ isLoop: true, isHome: true }), {
    dash: [],
    color: 'rgba(74,222,128,0.7)',
    width: 2.5
  });

  assert.deepEqual(renderLogic.getSegmentStyle({ isLoop: false, isHome: true }), {
    dash: [6, 4],
    color: 'rgba(96,165,250,0.7)',
    width: 2
  });
});

test('renderLogic.getSyncAreaStyle switches label and colors by occupancy', () => {
  assert.deepEqual(renderLogic.getSyncAreaStyle(true), {
    fill: 'rgba(250,204,21,0.22)',
    stroke: '#f59e0b',
    label: '使用中'
  });

  assert.deepEqual(renderLogic.getSyncAreaStyle(false), {
    fill: 'rgba(250,204,21,0.12)',
    stroke: '#facc15',
    label: '空き'
  });
});
