function getEnvironment(functionName) {
  const name = functionName.toLowerCase();

  if (name.includes("-prod-")) {
    return "prod";
  }

  if (name.includes("-uat-")) {
    return "uat";
  }

  if (name.includes("-test-")) {
    return "test";
  }

  if (name.includes("-qa-")) {
    return "qa";
  }

  if (name.includes("-dev-")) {
    return "dev";
  }

  return "-";
}

module.exports = {
  getEnvironment,
};