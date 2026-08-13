# eggshell

**eggshell is a Platform-Guided Generator** for turning a plain-language product idea into a working application foundation.

## Demo

### Create a simple sales system

> Create a simple sales system with products, customers and invoices, and a dashboard showing total sales, invoice count, customers and products.

<!-- Add the demo video here -->

## What is eggshell?

eggshell helps generate application experiences from a natural-language prompt. It relies on a pre-built platform of reusable building blocks, conventions, and capabilities rather than starting every project from an empty codebase.

This platform-guided approach is intended to improve development speed while preserving quality and consistency. The generator can focus on the product-specific work while the platform provides a dependable foundation for common application needs.

eggshell is an experimental app. Its workflows, generated output, and user experience are still evolving, and the project should be treated as a place to test ideas and learn what works.

## How to Install

### Prerequisites

- Node.js and npm installed locally
- An environment file based on `.env.example`

### Setup

```bash
git clone https://github.com/<your-account>/eggshell.git
cd eggshell
npm install
```

Copy `.env.example` to `.env`, add the required values, and generate the Prisma client:

```bash
npm run db:generate
```

Then start the development server:

```bash
npm run start:dev
```

For a production-style run:

```bash
npm run build
npm run start:prod
```

## Project status

The project is actively experimental. Expect incomplete features, changing APIs, and generated results that may need manual refinement.

<img src="path/to/architecture-chart.png" alt="Diagram showing how a user prompt flows through the platform-guided generator into a generated application" />

## I need testers

If you try this project, I'd especially like to know:

1. What application did you ask it to build?
2. What worked?
3. What broke?
4. What did you expect it to generate that it couldn't?
5. Roughly how much did generation cost?
