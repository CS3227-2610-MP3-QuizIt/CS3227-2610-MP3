'use strict';

const form = document.querySelector('#sample-form');
const feedback = document.querySelector('#feedback');
const reset = document.querySelector('#reset');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const answer = new FormData(form).get('answer');
  if (!answer) return;
  feedback.textContent = answer === 'sunlight'
    ? 'Exactly! Plants capture light energy from the sun to make sugars through photosynthesis.'
    : 'Good try. The answer is sunlight: plants use light energy to turn water and carbon dioxide into sugars.';
  reset.hidden = false;
});

reset.addEventListener('click', () => {
  form.reset();
  feedback.textContent = '';
  reset.hidden = true;
  form.querySelector('details').open = false;
  form.querySelector('input').focus();
});
