import test from "node:test";
import assert from "node:assert/strict";
import { quizCards } from "../quiz-list.mjs";

test("assignment cards preserve server order and status-dependent actions", () => {
  const cards = quizCards(["not_started", "in_progress", "submitted"].map((status, i) => ({
    id: i + 1, title: "Practice " + (i + 1), class_name: "Former class",
    question_count: 2, attempt_status: status,
  })));
  assert.deepEqual(cards.map(c => c.action), ["Start", "Resume", "View results"]);
  assert.equal(cards[2].href, "#/student/results/3");
  assert.equal(cards[0].className, "Former class");
});
test("no assignments produce no cards", () => assert.deepEqual(quizCards([]), []));
