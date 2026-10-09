# QuizIt product website

Plain HTML, CSS, and JavaScript. No installation or build step is required.
Open `index.html` directly, or run `python3 -m http.server 8080` from this folder
and visit http://localhost:8080.

## GitHub Pages

1. Commit these files and `.github/workflows/pages.yml` to `master` and push.
2. In the GitHub repository, choose **Settings → Pages → Source → GitHub Actions**.
3. Run **Actions → Deploy product website → Run workflow** on `master`, or push a
   website change to `master` after enabling Pages.
4. The deployment job reports the published URL. For the current repository, the
   expected URL is https://cs3227-2610-mp3-quizit.github.io/CS3227-2610-MP3/.

The workflow uploads only this folder. The product website does not host the
backend or the authenticated React application. Its sample question and hint are
prewritten and do not call AI. Update repository links if the repository moves.
