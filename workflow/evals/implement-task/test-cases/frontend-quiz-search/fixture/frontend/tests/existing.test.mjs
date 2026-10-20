import test from "node:test";
import assert from "node:assert/strict";
import {quizCards} from "../quiz-list.mjs";
test("cards retain order and actions", () => {
  const cards = quizCards(["not_started", "in_progress", "submitted"].map((s, i) =>
    ({id: i + 1, title: "Quiz", class_name: "Class", question_count: 1, attempt_status: s})));
  assert.deepEqual(cards.map(c => c.action), ["Start", "Resume", "View results"]);
  assert.equal(cards[2].href, "#/student/results/3");
});
test("empty list stays empty", () => assert.deepEqual(quizCards([]), []));
