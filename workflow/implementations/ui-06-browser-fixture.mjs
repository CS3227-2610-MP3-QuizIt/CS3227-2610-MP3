// Task6 synthetic-only fixture. No private DB, credentials or gateway calls.
// From repository root: node workflow/implementations/ui-06-browser-fixture.mjs
// From frontend: BACKEND_SERVER_URL=http://127.0.0.1:7066 npm run dev -- --port 5186 --host 127.0.0.1
// Dedicated preview: http://127.0.0.1:5186/#/student/results/1
// Actual frame viewports: http://127.0.0.1:5186/api/v1/task6-preview
// Quiz 1 = partial 10-question long review; 2 = perfect 1-question; 3 = zero 1-question.
import { createServer } from "node:http";
const options = { A: "First saved option", B: "Second saved option with additional text to check wrapping on narrow screens.", C: "Third saved option", D: "Fourth saved option" };
const quiz = (id) => ({ id, class_id: 1, title: id === 1 ? "Data structures: reviewing queues, stacks and how saved answers behave across a long submitted quiz" : `Boundary quiz ${id}`, question_count: id === 1 ? 10 : 1, status: "published", revision: 1, created_at: "2026-10-01T00:00:00Z", published_at: "2026-10-01T00:00:00Z", attempt_id: id * 10, attempt_status: "submitted", score: id === 1 ? 6 : id === 2 ? 1 : 0, questions: Array.from({length: id === 1 ? 10 : 1}, (_, index) => ({ id: index + 101, position: index + 1, question: `Saved question ${index + 1}: Which structure preserves the order in which entries arrived? Consider a long line of customers waiting to be served and the order that they leave.`, options })) });
const result = (id) => ({ id: id * 10, quiz_id: id, status: "submitted", score: quiz(id).score, total_questions: quiz(id).question_count, score_percent: id === 1 ? 60 : id === 2 ? 100 : 0, submitted_at: "2026-10-01T00:30:00Z", questions: quiz(id).questions.map((question) => ({ ...question, selected_option: "B", correct_option: id === 2 || (id === 1 && ![2,4,7,9].includes(question.position)) ? "B" : "D", is_correct: id === 2 || (id === 1 && ![2,4,7,9].includes(question.position)), explanation: "A queue preserves arrival order.\nThe first entry is the first removed. This saved explanation is intentionally long to exercise wrapping and page scrolling.\n<script>These tags are plain text.</script>\n" + "Consider the order of operations before choosing a structure. ".repeat(8) })) });
createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  if (req.url === "/api/v1/ai/events") { res.writeHead(200, {"Content-Type": "text/event-stream"}); res.write(": fixture connected\n\n"); return; }
  if (req.url === "/api/v1/task6-preview") {
    res.writeHead(200, {"Content-Type":"text/html", "Cache-Control":"no-store"});
    res.end(`<!doctype html><html lang="en"><meta charset="UTF-8"><title>Task6 isolated responsive fixture</title><style>body{font:14px system-ui;margin:16px;background:#e8ece5}main{display:flex;align-items:start;gap:24px;flex-wrap:wrap}iframe{height:1000px;border:1px solid #536555;display:block}h1{font-size:20px}</style><h1>Task6 synthetic results: actual frame viewports</h1><p>Each frame uses a separate 320px or 390px browsing context. This is not browser zoom.</p><main><section><h2>320px</h2><iframe title="Task6 320px results" width="320" src="/#/student/results/1"></iframe></section><section><h2>390px</h2><iframe title="Task6 390px results" width="390" src="/#/student/results/1"></iframe></section></main></html>`);
    return;
  }
  let data;
  if (req.url === "/api/v1/auth/me") data = { id: 3, username: "fixture-student", display_name: "Fixture Student", role: "student" };
  const quizMatch = req.url.match(/^\/api\/v1\/quizzes\/(\d+)$/);
  const resultMatch = req.url.match(/^\/api\/v1\/attempts\/(\d+)\/results$/);
  const attemptMatch = req.url.match(/^\/api\/v1\/attempts\/(\d+)$/);
  if (quizMatch) data = quiz(Number(quizMatch[1]));
  if (resultMatch) data = result(Number(resultMatch[1])/10);
  if (attemptMatch) data = { id: Number(attemptMatch[1]), quiz_id: Number(attemptMatch[1])/10, status: "submitted", started_at: "2026-10-01T00:00:00Z", answers: [], hints: [] };
  res.writeHead(data ? 200 : 404, {"Content-Type":"application/json", "Cache-Control":"no-store"});
  res.end(JSON.stringify(data || { error: { code: "FIXTURE_ROUTE", message: "Fixture route unavailable" } }));
}).listen(7066, "127.0.0.1", () => console.log("Task6 fixture listening on 127.0.0.1:7066"));
