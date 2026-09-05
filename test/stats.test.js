const { recordStats, getStatsHistory } = require("../lib/stats");

describe("stats", () => {
  test("recordStats records stats to DB", () => {
    const run = jest.fn();
    const mockDb = {
      prepare: jest.fn().mockReturnValue({ run })
    };
    
    recordStats("v1", 100, mockDb);
    
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO video_stats"));
    expect(run).toHaveBeenCalledWith("v1", expect.any(Number), 100);
  });

  test("getStatsHistory retrieves stats from DB", () => {
    const all = jest.fn().mockReturnValue([{ timestamp: 1, view_count: 50 }]);
    const mockDb = {
      prepare: jest.fn().mockReturnValue({ all })
    };
    
    const result = getStatsHistory("v1", mockDb);
    
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT timestamp, view_count FROM video_stats"));
    expect(all).toHaveBeenCalledWith("v1");
    expect(result).toEqual([{ timestamp: 1, view_count: 50 }]);
  });
});
