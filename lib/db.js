const mockStmt = {
  run: jest.fn(),
  all: jest.fn().mockReturnValue([]),
  get: jest.fn().mockReturnValue(null),
};

const db = {
  prepare: jest.fn().mockReturnValue(mockStmt),
  exec: jest.fn(),
};

module.exports = db;
