function step(name, msg) {
  console.log(`\n➡️ [${name}] ${msg}`);
}

function ok(name, msg) {
  console.log(`✅ [${name}] ${msg}`);
}

function fail(name, msg) {
  console.log(`❌ [${name}] ${msg}`);
}

// IMPORTANT: correct export
module.exports = {
  step,
  ok,
  fail,
};