export function gradeAnswer(answer: string, expected: string): boolean {
  return answer.trim() === expected.trim();
}
