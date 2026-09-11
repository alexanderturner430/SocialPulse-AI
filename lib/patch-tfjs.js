/**
 * Compatibility patch for @tensorflow/tfjs-node 4.22.0 on modern Node (>=23).
 *
 * tfjs-node 4.22.0's compiled dist still calls legacy util helpers
 * (util.isNullOrUndefined, util.isArray, ...) that were removed from Node's
 * `util` module in v4.0.0. This causes:
 *   TypeError: (0 , util_1.isNullOrUndefined) is not a function
 *
 * Upstream fix: https://github.com/tensorflow/tfjs/pull/8425 (not yet released).
 * This polyfill restores the deprecated helpers on the shared `util` module so
 * the installed tfjs-node works until an upstream release lands.
 */

"use strict";

const util = require("util");

const lookup = (value) => Object.prototype.toString.call(value).slice(8, -1);

const helpers = {
  isArray: (value) => Array.isArray(value),
  isBoolean: (value) => typeof value === "boolean",
  isBuffer: (value) => Buffer.isBuffer(value),
  isDate: (value) => lookup(value) === "Date",
  isError: (value) => value instanceof Error,
  isFunction: (value) => typeof value === "function",
  isNull: (value) => value === null,
  isNullOrUndefined: (value) => value === null || value === undefined,
  isNumber: (value) => typeof value === "number",
  isObject: (value) =>
    (typeof value === "object" && value !== null) || typeof value === "function",
  isPrimitive: (value) =>
    value === null || (typeof value !== "function" && typeof value !== "object"),
  isRegExp: (value) => lookup(value) === "RegExp",
  isString: (value) => typeof value === "string",
  isSymbol: (value) => typeof value === "symbol",
  isUndefined: (value) => value === undefined,
};

for (const [name, fn] of Object.entries(helpers)) {
  if (typeof util[name] !== "function") util[name] = fn;
}

module.exports = util;