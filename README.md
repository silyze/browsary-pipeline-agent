# Browsary Pipeline Agent

An AI-driven pipeline evaluator that runs browser automation functions via Puppeteer and the Browsary AI Provider.

## Installation

```bash
npm install @silyze/browsary-pipeline-agent
```

## Usage

```ts
import { PipelineAgent, AgentConfig } from "@silyze/browsary-pipeline-agent";
import { URLBrowserProvider } from "@silyze/browser-provider";
import { createJsonLogger } from "@silyze/logger";
import OpenAI from "openai";
import { OpenAiProvider } from "@silyze/browsary-ai-provider";

// 1. Provide a BrowserProvider or Puppeteer Browser

const agentConfig: AgentConfig = {
  browser: new URLBrowserProvider(),
  viewport: { width: 1280, height: 800 },
};

// 2. Instantiate the agent
const agent = new PipelineAgent(agentConfig);

// 3. Create an AI context for evaluation
const context = agent.createContext(OpenAiProvider, {
  openAi: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  pipelineProvider: new PipelineProvider(),
  logger: createJsonLogger(console.log),
});

// 4. Evaluate a function within the browser page context
const result = await agent.evaluate(async (page: Page) => {
  await page.goto("https://example.com");
  return page.url();
});
```

## API Reference

### Class: `PipelineAgent`

Extends `AiEvaluator<Page>`, enabling evaluation of browser-based functions with AI contexts.

#### `constructor(config: AgentConfig)`

- **config**: Configuration for browser provider and optional viewport.

#### `createContext(constructor, config)`

```ts
createContext<TConfig>(
  constructor: new (
    config: TConfig,
    functionCall: (context: Page, name: string, params: any) => Promise<unknown>
  ) => AiProvider<Page, TConfig>,
  config: TConfig
): AiEvaluationContext<Page>
```

- Instantiates the provided `AiProvider` subclass.
- Binds internal function-call dispatcher.
- Returns an evaluation context with `{ provider, agent }`.

#### `evaluate(fn, ...args)`

```ts
evaluate<TArgs extends any[], TResult>(
  fn: (context: Page, ...args: TArgs) => TResult,
  ...args: TArgs
): Promise<Awaited<TResult>>
```

- Acquires a browser instance via `AgentConfig.browser`.
- Opens a new `Page` and applies optional `viewport` settings.
- Executes `fn(page, ...args)` and returns its result.
- Ensures the page is closed and the browser is released.

---

### Internal Function Calls

AI-driven function calls (`querySelector`, `goto`, `click`, `type`, `url`) are dispatched through `#functionCall`, which invokes private methods:

- `#querySelector` / `#querySelectorAll` — Returns parsed and compressed HTML nodes.
- `#goto` — Navigates to the given URL with a Puppeteer lifecycle event.
- `#click` — Clicks elements, optionally waiting for navigation.
- `#type` — Types text into an element with configurable delay.
- `#url` — Retrieves the current page URL.

## Environment Variables

- `OPENAI_API_KEY` — API key for OpenAI client (used by `OpenAiProvider`).
