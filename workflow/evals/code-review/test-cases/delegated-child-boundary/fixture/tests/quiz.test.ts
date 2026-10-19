import { gradeAnswer } from "../src/quiz";

test("grades the expected answer", () => {
  expect(gradeAnswer("A", "A")).toBe(true);
});
