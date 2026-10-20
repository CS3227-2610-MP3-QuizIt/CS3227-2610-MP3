import { quizCards } from "./quiz-list.mjs";

export function QuizList({ items }) {
  return <section aria-label="My quizzes">
    <h1>My quizzes</h1>
    <div className="quiz-grid">{quizCards(items).map(card =>
      <article key={card.id} className="quiz-card">
        <span>{card.status}</span><h2>{card.title}</h2>
        <p>{card.className} · {card.count} questions</p>
        <a href={card.href}>{card.action}</a>
      </article>
    )}</div>
  </section>;
}
