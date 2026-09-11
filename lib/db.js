const mockStmt = {
  run: () => {},
  all: () => [],
  get: () => null,
};

const db = {
  prepare: () => mockStmt,
  exec: () => {},
};

module.exports = db;