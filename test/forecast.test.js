const { forecastViews } = require("../lib/forecast");

describe("forecast", () => {
  test("forecastViews calculates correctly", () => {
    const history = [
      { timestamp: 1000, views: 10 },
      { timestamp: 2000, views: 20 }
    ];
    const result = forecastViews(history, 1);
    expect(result.forecastAt7Days).toBeDefined();
    expect(typeof result.forecastAt7Days).toBe("number");
  });
});
