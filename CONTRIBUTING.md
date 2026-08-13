# Contributing to eggshell

Thanks for helping improve eggshell, a Platform-Guided Generator. Because the project is experimental, thoughtful feedback and small, focused changes are especially valuable.

## Before you start

1. Check existing issues and pull requests to avoid duplicate work.
2. For a substantial change, open an issue first so the approach can be discussed.
3. Never commit secrets, local database files, credentials, or private user data.

## Local development

```bash
npm install
Copy-Item .env.example .env
npm run start:dev
```

Use the equivalent copy command for your operating system if needed. Before opening a pull request, run:

```bash
npm run lint
npm test
npm run build
```

## Issues and experiments

Use the standard issue templates for bug reports and feature requests. When reporting generated output, include the prompt, expected result, actual result, reproduction steps, and screenshots or logs where useful. Remove sensitive information first.

## Pull requests

- Keep each pull request focused on one change.
- Explain the motivation and summarize the implementation.
- Add or update tests when behavior changes.
- Update documentation when setup or user-facing behavior changes.
- Ensure checks pass before requesting review.

Please be constructive and respectful in issues, reviews, and discussions. Contributions may be revised as the project learns from testing.
