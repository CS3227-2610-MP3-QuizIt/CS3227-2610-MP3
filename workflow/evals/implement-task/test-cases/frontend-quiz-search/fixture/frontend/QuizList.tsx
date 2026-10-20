import {quizCards} from "./quiz-list.mjs";

export function QuizList({items}) {
  return <section aria-label="My quizzes">
    <h1>My quizzes</h1>
    <div className="quiz-grid">{quizCards(items).map(card =>
      <article key={card.id}>
        <h2>{card.title}</h2><p>{card.className}</p>
        <a href={card.href}>{card.action}</a>
      </article>
    )}</div>
  </section>;
}
