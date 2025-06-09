import type { Browser, Page, PuppeteerLifeCycleEvent } from "puppeteer-core";
import { BrowserProvider, ViewportConfig } from "@silyze/browser-provider";
import { HTMLTextStream, HTMLSerializer } from "@silyze/html-prompt-utils";
import { compressNode } from "@silyze/html-prompt-utils";
import {
  AiProvider,
  AiEvaluator,
  AiEvaluationContext,
} from "@silyze/browsary-ai-provider";

export type AgentConfig = {
  browser: BrowserProvider<unknown> | Browser | Promise<Browser>;
  viewport?: ViewportConfig;
};

export class PipelineAgent extends AiEvaluator<Page> {
  #config: AgentConfig;
  constructor(config: AgentConfig) {
    super();
    this.#config = config;
  }

  createContext<TConfig>(
    constuctor: new (
      config: TConfig,
      functionCall: (
        context: Page,
        name: string,
        params: any
      ) => Promise<unknown>
    ) => AiProvider<Page, TConfig>,
    config: TConfig
  ): AiEvaluationContext<Page> {
    const provider = new constuctor(config, (context, name, params) =>
      this.#functionCall(context, name, params)
    );
    return { provider, agent: this };
  }

  async evaluate<TArgs extends any[], TResult>(
    fn: (context: Page, ...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<Awaited<TResult>> {
    let browser: Browser;
    if (this.#config.browser instanceof BrowserProvider) {
      browser = await this.#config.browser.getBrowser();
    } else {
      browser = await this.#config.browser;
    }

    try {
      if (browser) {
        const page = await browser.newPage();
        if (this.#config.viewport) {
          await page.setViewport(this.#config.viewport);
        }
        try {
          return await fn(page, ...args);
        } finally {
          await page.close();
        }
      } else {
        return await fn(null!, ...args);
      }
    } finally {
      if (this.#config.browser instanceof BrowserProvider) {
        await this.#config.browser.releaseBrowser(browser);
      }
    }
  }

  async #functionCall(page: Page, name: string, params: any) {
    switch (name) {
      case "querySelector":
        return await this.#querySelector(page, params.selector);
      case "querySelectorAll":
        return await this.#querySelectorAll(page, params.selector);

      case "goto":
        await this.#goto(page, params.url, params.waitUntil);
        break;
      case "click":
        await this.#click(page, params.selector, params.waitForNavigation);
        break;
      case "type":
        await this.#type(page, params.selector, params.text, params.delayMs);
        break;
      case "url":
        return this.#url(page);
      default:
        throw new TypeError(`Invalid function call`);
    }
  }

  #url(page: Page) {
    return page.url();
  }

  async #goto(page: Page, url: string, waitUntil: PuppeteerLifeCycleEvent) {
    await page.goto(new URL(url, page.url()).toString(), { waitUntil });
  }

  async #type(page: Page, selector: string, text: string, delay: number) {
    await page.type(selector, text, { delay });
  }

  async #click(page: Page, selector: string, waitForNavigation: boolean) {
    if (waitForNavigation) {
      await Promise.all([page.waitForNavigation(), page.click(selector)]);
    } else {
      await page.click(selector);
    }
  }
  async #querySelector<T extends string>(page: Page, selector: T) {
    const html = await page.$eval(selector, (el) => el.outerHTML);
    const root = await HTMLSerializer.parse(new HTMLTextStream(html));
    return compressNode(root) ?? {};
  }
  async #querySelectorAll<T extends string>(page: Page, selector: T) {
    const html = await page.$$eval(selector, (els) =>
      els.map((el) => el.outerHTML).join("")
    );
    const root = await HTMLSerializer.parse(new HTMLTextStream(html));
    return compressNode(root) ?? {};
  }
}
