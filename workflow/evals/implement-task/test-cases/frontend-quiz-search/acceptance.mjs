// Private acceptance oracle; evaluates the specified public view-model contract.
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import path from "node:path";
const root = process.argv[2];
const {quizCards} = await import(pathToFileURL(path.join(root, "frontend/quiz-list.mjs")));
const items = [
  {id: 7, title: "Arrays", class_name: "CS Alpha", question_count: 2, attempt_status: "not_started"},
  {id: 3, title: "Trees", class_name: "CS Beta", question_count: 4, attempt_status: "in_progress"},
  {id: 9, title: "Regex a[", class_name: "CS Alpha", question_count: 1, attempt_status: "submitted"},
];
const before = JSON.stringify(items);
const ids = q => quizCards(items, q).map(c => c.id);
assert.deepEqual(ids("  tReEs "), [3]);
assert.deepEqual(ids("  ALPHA "), [7, 9]);
assert.deepEqual(ids("a["), [9]);
assert.deepEqual(ids(""), [7, 3, 9]);
assert.deepEqual(ids("   "), [7, 3, 9]);
assert.deepEqual(ids("missing"), []);
assert.deepEqual(quizCards([], "anything"), []);
assert.deepEqual(quizCards(items).map(c => c.action), ["Start", "Resume", "View results"]);
assert.deepEqual(quizCards(items).map(c => c.href),
  ["#/student/attempt/7", "#/student/attempt/3", "#/student/results/9"]);
assert.equal(JSON.stringify(items), before);
console.log("Private quiz-search acceptance passed");
