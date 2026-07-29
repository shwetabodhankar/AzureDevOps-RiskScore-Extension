const assert = require("assert");
const {
  calculateRiskScore,
  shouldRecalculateFromChangedFields,
  shouldWriteCalculatedScore,
  shouldClearScore,
} = require("../dist-tests/riskScoreCalculator");

function testAllValidCombinations() {
  for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
    for (let impact = 1; impact <= 3; impact += 1) {
      const result = calculateRiskScore(likelihood, impact);
      assert.strictEqual(result.isValid, true, `Expected valid result for ${likelihood}x${impact}`);
      assert.strictEqual(result.score, likelihood * impact, `Unexpected score for ${likelihood}x${impact}`);
    }
  }
}

function testBoundaryValues() {
  assert.strictEqual(calculateRiskScore(1, 1).score, 1);
  assert.strictEqual(calculateRiskScore(5, 3).score, 15);
  assert.strictEqual(calculateRiskScore(5, 1).score, 5);
  assert.strictEqual(calculateRiskScore(3, 2).score, 6);
  assert.strictEqual(calculateRiskScore(4, 2).score, 8);
  assert.strictEqual(calculateRiskScore(3, 3).score, 9);
}

function testMissingLikelihood() {
  const result = calculateRiskScore(undefined, 2);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.score, null);
}

function testMissingImpact() {
  const result = calculateRiskScore(3, undefined);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.score, null);
}

function testInvalidStrings() {
  assert.strictEqual(calculateRiskScore("abc", 2).isValid, false);
  assert.strictEqual(calculateRiskScore(2, "not-a-number").isValid, false);
  assert.strictEqual(calculateRiskScore("", 2).isValid, false);
}

function testDecimals() {
  assert.strictEqual(calculateRiskScore(1.2, 2).isValid, false);
  assert.strictEqual(calculateRiskScore(2, 2.5).isValid, false);
}

function testZeroAndNegativeValues() {
  assert.strictEqual(calculateRiskScore(0, 2).isValid, false);
  assert.strictEqual(calculateRiskScore(2, 0).isValid, false);
  assert.strictEqual(calculateRiskScore(-1, 2).isValid, false);
  assert.strictEqual(calculateRiskScore(2, -1).isValid, false);
}

function testOutOfRangeValues() {
  assert.strictEqual(calculateRiskScore(6, 2).isValid, false);
  assert.strictEqual(calculateRiskScore(2, 4).isValid, false);
}

function testPreventRedundantWrites() {
  assert.strictEqual(shouldWriteCalculatedScore(8, 8), false);
  assert.strictEqual(shouldWriteCalculatedScore("8", 8), false);
  assert.strictEqual(shouldWriteCalculatedScore(7, 8), true);
  assert.strictEqual(shouldWriteCalculatedScore(null, 8), true);
}

function testPreventRecursiveUpdatesDecision() {
  assert.strictEqual(shouldClearScore(null), false);
  assert.strictEqual(shouldClearScore(undefined), false);
  assert.strictEqual(shouldClearScore(""), false);
  assert.strictEqual(shouldClearScore(5), true);
  assert.strictEqual(shouldClearScore("5"), true);

  assert.strictEqual(
    shouldRecalculateFromChangedFields(
      { "Custom.RiskScore": 8 },
      "Custom.RiskLikelihood",
      "Custom.RiskImpact",
      "Custom.RiskScore"
    ),
    false
  );

  assert.strictEqual(
    shouldRecalculateFromChangedFields(
      { "Custom.RiskLikelihood": 4 },
      "Custom.RiskLikelihood",
      "Custom.RiskImpact",
      "Custom.RiskScore"
    ),
    true
  );

  assert.strictEqual(
    shouldRecalculateFromChangedFields(
      { "Custom.RiskImpact": 2 },
      "Custom.RiskLikelihood",
      "Custom.RiskImpact",
      "Custom.RiskScore"
    ),
    true
  );
}

function runTests() {
  testAllValidCombinations();
  testBoundaryValues();
  testMissingLikelihood();
  testMissingImpact();
  testInvalidStrings();
  testDecimals();
  testZeroAndNegativeValues();
  testOutOfRangeValues();
  testPreventRedundantWrites();
  testPreventRecursiveUpdatesDecision();
  console.log("All Risk Score tests passed.");
}

runTests();
