# Egg Shell

**eggshell is a Platform-Guided Generator** for turning a plain-language product idea into a working application foundation.

## Demo

### Create a simple sales system

> Create a simple sales system with products, customers and invoices, and a dashboard showing total sales, invoice count, customers and products.

https://github.com/user-attachments/assets/6e6bc6fe-b9ca-483d-9ad5-83127a918d03

## What is eggshell?

eggshell helps generate application experiences from a natural-language prompt. It relies on a pre-built platform of reusable building blocks, conventions, and capabilities rather than starting every project from an empty codebase.

This platform-guided approach is intended to improve development speed while preserving quality and consistency. The generator can focus on the product-specific work while the platform provides a dependable foundation for common application needs.

eggshell is an experimental app. Its workflows, generated output, and user experience are still evolving, and the project should be treated as a place to test ideas and learn what works.

## Why?
An open-ended system requires an AI agent to build everything from scratch. Navigating this forces the model to make hundreds of low-level choices, dramatically increasing the risk of broken setup, hallucinated dependencies, or missing code.

<img width="1408" height="768" alt="open-ended-system" src="https://github.com/user-attachments/assets/602288e8-568f-498b-8b62-d0c94432cebf" />

By contrast, a platform-guided generator automatically handles all underlying boilerplate. By stripping away infrastructure decisions and locking the focus strictly to application logic, the model operates within a much narrower decision space—resulting in far more reliable, production-ready output.

<img width="1408" height="768" alt="platform-guided-generation" src="https://github.com/user-attachments/assets/c2cddf62-9b7c-4860-bac7-d8ebf6552824" />

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

## I need testers

If you try this project, I'd especially like to know:

1. What application did you ask it to build?
2. What worked?
3. What broke?
4. What did you expect it to generate that it couldn't?
5. Roughly how much did generation cost?
