const discord = require("../lib/discord");

jest.mock("node-fetch");
const fetch = require("node-fetch");

describe("discord", () => {
  beforeEach(() => {
    process.env.DISCORD_BOT_TOKEN = "test-token";
    jest.clearAllMocks();
  });

  test("getServer fetches server info", async () => {
    const mockGuild = {
      id: "123456789012345678",
      name: "Test Server",
      approximate_member_count: 100
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockGuild),
        status: 200
      })
    );

    const server = await discord.getServer("guild123");
    expect(server.name).toBe("Test Server");
    expect(server.members).toBe(100);
  });
});
