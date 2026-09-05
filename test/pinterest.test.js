const pinterest = require("../lib/pinterest");

global.fetch = jest.fn();
process.env.PINTEREST_ACCESS_TOKEN = "test-token";

describe("pinterest", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test("getPin returns formatted pin data", async () => {
    fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        id: "p1",
        title: "Test Pin",
        description: "Desc",
        board: { id: "b1", name: "Board" },
        images: { "736x": { url: "url" } }
      })
    });

    const pin = await pinterest.getPin("p1");
    expect(pin.id).toBe("p1");
    expect(pin.title).toBe("Test Pin");
    expect(fetch).toHaveBeenCalled();
  });
});
