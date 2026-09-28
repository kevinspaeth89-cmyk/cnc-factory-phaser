'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const quality = require('../systems/programmingQuality.js');

test('qualified QS detects substantially more defects than operator-only inspection', () => {
  const operator = quality.inspectionDetectionChance({
    hasQualityAssurance: false,
    precision: 8,
    trained: 2
  });
  const qs = quality.inspectionDetectionChance({
    hasQualityAssurance: true,
    precision: 8,
    trained: 2
  });

  assert.ok(operator >= 0.36 && operator <= 0.78);
  assert.ok(qs >= 0.80 && qs <= 0.99);
  assert.ok(qs > operator);
});

test('QS precision improves detection while remaining below certainty', () => {
  const low = quality.inspectionDetectionChance({
    hasQualityAssurance: true,
    precision: 3,
    trained: 0
  });
  const high = quality.inspectionDetectionChance({
    hasQualityAssurance: true,
    precision: 10,
    trained: 3
  });

  assert.ok(high > low);
  assert.ok(high <= 0.99);
  assert.ok(low >= 0.80);
});

test('active QS gives a small process-risk reduction', () => {
  assert.equal(quality.qualityProcessRiskModifier({
    hasQualityAssurance: false,
    precision: 10
  }), 0);

  const average = quality.qualityProcessRiskModifier({
    hasQualityAssurance: true,
    precision: 5
  });
  const precise = quality.qualityProcessRiskModifier({
    hasQualityAssurance: true,
    precision: 10
  });

  assert.ok(average < 0);
  assert.ok(precise < average);
  assert.ok(precise >= -1);
});


test('QS inspection policies trade time for detection quality', () => {
  const common = { hasQualityAssurance: true, precision: 7, trained: 1 };
  const sampling = quality.inspectionDetectionChance({ ...common, policy: 'sampling' });
  const standard = quality.inspectionDetectionChance({ ...common, policy: 'standard' });
  const full = quality.inspectionDetectionChance({ ...common, policy: 'full' });

  assert.ok(sampling < standard);
  assert.ok(standard < full);

  const order = { difficulty: 4 };
  assert.ok(quality.inspectionMinutes({ order, policy: 'sampling' }) <
    quality.inspectionMinutes({ order, policy: 'standard' }));
  assert.ok(quality.inspectionMinutes({ order, policy: 'standard' }) <
    quality.inspectionMinutes({ order, policy: 'full' }));
});

test('stronger QS inspection reduces process risk more', () => {
  const sampling = quality.qualityProcessRiskModifier({
    hasQualityAssurance: true, precision: 7, policy: 'sampling'
  });
  const standard = quality.qualityProcessRiskModifier({
    hasQualityAssurance: true, precision: 7, policy: 'standard'
  });
  const full = quality.qualityProcessRiskModifier({
    hasQualityAssurance: true, precision: 7, policy: 'full'
  });

  assert.ok(sampling > standard);
  assert.ok(standard > full);
  assert.equal(quality.inspectionPolicy('unknown').id, 'standard');
});
