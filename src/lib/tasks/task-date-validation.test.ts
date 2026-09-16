import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertValidTaskDueDate,
  isAbsurdTaskDate,
  isTaskDateYearInRange,
  parseTaskDueDate,
  TASK_DATE_INVALID_MESSAGE,
} from "./task-date-validation";

describe("task date validation", () => {
  it("accepts years 2000–2100", () => {
    assert.equal(isTaskDateYearInRange(new Date("2026-08-01")), true);
    assert.equal(isTaskDateYearInRange(new Date("2000-01-01")), true);
    assert.equal(isTaskDateYearInRange(new Date("2100-12-31")), true);
  });

  it("rejects absurd years", () => {
    assert.equal(isTaskDateYearInRange(new Date("1999-12-31")), false);
    assert.equal(isTaskDateYearInRange(new Date("2101-01-01")), false);
    assert.equal(isAbsurdTaskDate("2105-01-01T00:00:00.000Z"), true);
    assert.equal(isAbsurdTaskDate("2026-01-01T00:00:00.000Z"), false);
  });

  it("assertValidTaskDueDate throws Uzbek error", () => {
    assert.throws(
      () => assertValidTaskDueDate("2200-01-01"),
      (err: Error) => err.message === TASK_DATE_INVALID_MESSAGE
    );
    assert.throws(
      () => assertValidTaskDueDate("not-a-date"),
      (err: Error) => err.message === TASK_DATE_INVALID_MESSAGE
    );
  });

  it("parseTaskDueDate returns null for invalid", () => {
    assert.equal(parseTaskDueDate(null), null);
    assert.equal(parseTaskDueDate("2200-01-01"), null);
    assert.ok(parseTaskDueDate("2026-05-01") instanceof Date);
  });
});
