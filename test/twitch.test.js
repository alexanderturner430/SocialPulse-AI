const { getChannel } = require("../lib/twitch");

jest.mock("node-fetch");
const fetch = require("node-fetch");

describe("twitch", () => {
  beforeEach(() => {
    process.env.TWITCH_CLIENT_ID = "cid";
    process.env.TWITCH_ACCESS_TOKEN = "token";
    jest.clearAllMocks();
  });

  test("getChannel fetches channel", async () => {
    const mockData = {
        data: [{
            broadcaster_id: "u1",
            broadcaster_name: "testuser",
            broadcaster_login: "testuser",
            title: "stream title",
            game_name: "game",
            game_id: "g1"
        }]
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData)
      })
    );

    const channel = await getChannel("u1");
    expect(channel.name).toBe("testuser");
  });
});
