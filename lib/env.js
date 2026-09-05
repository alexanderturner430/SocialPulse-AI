require("dotenv").config();
module.exports = { get: (key, fallback) => process.env[key] || fallback };
