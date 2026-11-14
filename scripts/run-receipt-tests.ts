import assert from "node:assert/strict";
import { test } from "node:test";
import { GeminiClient } from "../src/lib/llm/gemini-client";
import { OpenRouterClient } from "../src/lib/llm/openrouter-client";
import { AppError } from "../src/lib/errors";
import { apiError, mapErrorMessage } from "../src/lib/constants";
import { scanReceipt } from "../src/lib/scan-receipt";

const input = { imageBuffer: Buffer.from("receipt"), mimeType: "image/jpeg" };
const receipt = { menu: [{ nm: "Tea", price: 2 }], total_price: 2 };
const overloaded = () => Response.json({ error: {
  code: 503,
  message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
  status: "UNAVAILABLE",
} }, { status: 503 });
const success = () => Response.json({
  candidates: [{ content: { parts: [{ text: JSON.stringify(receipt) }] } }],
});

test("extractReceipt recovers when overload clears during retries", async (t) => {
  const delays: number[] = [];
  t.mock.method(Math, "random", () => 0);
  t.mock.method(globalThis, "setTimeout", (callback: () => void, ms: number) => {
    delays.push(ms);
    callback();
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls < 3 ? overloaded() : success());
  assert.deepEqual(await new GeminiClient("test-key").extractReceipt(input), receipt);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("persistent Gemini overload reaches the scanner as temporary unavailability", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return overloaded();
  });
  let failure: AppError | undefined;
  await assert.rejects(new GeminiClient("test-key").extractReceipt(input), (err: unknown) => {
    assert.ok(err instanceof AppError);
    failure = err;
    return true;
  });
  assert.equal(calls, 3);
  assert.ok(failure);
  assert.equal(failure.httpStatus, 503);
  assert.equal(failure.code, "LLM_UNAVAILABLE");
  assert.equal(failure.retryable, true);
  // Keep the provider's diagnostic detail in server logs.
  assert.match(failure.message, /high demand/);
  // Use the route's real error serialization before exercising the UI helper.
  const response = apiError(mapErrorMessage(failure), failure.code);
  assert.doesNotMatch(response.error, /Gemini|UNAVAILABLE|Too many scans/);
  fetchMock.mock.mockImplementation(async () => Response.json(response, { status: failure!.httpStatus }));
  assert.deepEqual(await scanReceipt(new File(["receipt"], "receipt.jpg", { type: "image/jpeg" })), {
    ok: false,
    failure: {
      title: "Receipt scanning is busy",
      message: "Receipt scanning is temporarily busy. Try again shortly, or enter the expense manually.",
      retryable: true,
    },
  });
});

test("invalid credentials fail immediately without being called overload", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: { message: "Invalid API key" } }, { status: 403 });
  });
  await assert.rejects(new GeminiClient("test-key").extractReceipt(input), {
    code: "LLM_FAILED", httpStatus: 502, retryable: false,
  });
  assert.equal(calls, 1);
});

test("per-minute rate limits retain their distinct retry advice", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: { status: "RESOURCE_EXHAUSTED" } }, { status: 429 });
  });
  await assert.rejects(new GeminiClient("test-key").extractReceipt(input), {
    code: "LLM_RATE_LIMITED",
    httpStatus: 429,
    message: "Too many scans in the last minute. Wait about a minute, then try again.",
  });
  assert.equal(calls, 3);
});

test("an HTML 503 also gives temporary service advice", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<h1>Unavailable</h1>", { status: 503 }));
  const result = await scanReceipt(new File(["receipt"], "receipt.jpg", { type: "image/jpeg" }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.title, "Receipt scanning is busy");
    assert.match(result.failure.message, /Try again shortly/);
    assert.equal(result.failure.retryable, true);
  }
});

const requestedModel = (url: unknown) => String(url).match(/models\/([^:]+):/)?.[1];

test("an overloaded model falls back to the next one instead of being asked again", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  const models: (string | undefined)[] = [];
  t.mock.method(globalThis, "fetch", async (url: unknown) => {
    models.push(requestedModel(url));
    return requestedModel(url) === "primary" ? overloaded() : success();
  });
  assert.deepEqual(
    await new GeminiClient("test-key", ["primary", "fallback"]).extractReceipt(input),
    receipt
  );
  assert.deepEqual(models, ["primary", "fallback"]);
});

test("a call that never answers is abandoned and retried on the next model", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  const models: (string | undefined)[] = [];
  t.mock.method(globalThis, "fetch", async (url: unknown) => {
    models.push(requestedModel(url));
    if (requestedModel(url) === "primary") {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }
    return success();
  });
  assert.deepEqual(
    await new GeminiClient("test-key", ["primary", "fallback"]).extractReceipt(input),
    receipt
  );
  assert.deepEqual(models, ["primary", "fallback"]);
});

test("every model timing out reaches the scanner as temporary unavailability", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  });
  let failure: AppError | undefined;
  await assert.rejects(new GeminiClient("test-key").extractReceipt(input), (err: unknown) => {
    assert.ok(err instanceof AppError);
    failure = err;
    return true;
  });
  assert.ok(failure);
  assert.equal(failure.code, "LLM_UNAVAILABLE");
  assert.equal(failure.httpStatus, 503);
  assert.doesNotMatch(mapErrorMessage(failure), /Gemini|timed out/);
});

test("every Gemini call carries a deadline, and the key stays out of the URL", async (t) => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    seenUrl = String(url);
    seenInit = init;
    return success();
  });
  await new GeminiClient("test-key").extractReceipt(input);
  assert.ok(seenInit?.signal instanceof AbortSignal);
  assert.doesNotMatch(seenUrl, /test-key/);
  assert.equal(new Headers(seenInit?.headers).get("x-goog-api-key"), "test-key");
});

// ── OpenRouter ──────────────────────────────────────────────────────

const completion = (content: string) =>
  Response.json({ choices: [{ message: { content }, finish_reason: "stop" }] });
const sentBody = (init?: RequestInit) => JSON.parse(String(init?.body));

test("OpenRouter sends the image, a strict schema and a deadline, with the key in a header", async (t) => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    seenUrl = String(url);
    seenInit = init;
    return completion(JSON.stringify(receipt));
  });
  assert.deepEqual(await new OpenRouterClient("test-key").extractReceipt(input), receipt);

  const body = sentBody(seenInit);
  assert.equal(body.model, "deepseek/deepseek-v4.1-flash");
  assert.equal(
    body.messages[0].content[1].image_url.url,
    `data:image/jpeg;base64,${input.imageBuffer.toString("base64")}`
  );
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.provider.require_parameters, true);
  assert.ok(seenInit?.signal instanceof AbortSignal);
  assert.doesNotMatch(seenUrl, /test-key/);
  assert.equal(new Headers(seenInit?.headers).get("authorization"), "Bearer test-key");
});

test("OpenRouter falls back to the next model when the first is unavailable", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  const models: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const { model } = sentBody(init);
    models.push(model);
    return model === "primary"
      ? Response.json({ error: { code: 503, message: "No available provider" } }, { status: 503 })
      : completion(JSON.stringify(receipt));
  });
  assert.deepEqual(
    await new OpenRouterClient("test-key", ["primary", "fallback"]).extractReceipt(input),
    receipt
  );
  assert.deepEqual(models, ["primary", "fallback"]);
});

test("OpenRouter falls back when a call never answers", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  const models: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const { model } = sentBody(init);
    models.push(model);
    if (model === "primary") {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }
    return completion(JSON.stringify(receipt));
  });
  assert.deepEqual(
    await new OpenRouterClient("test-key", ["primary", "fallback"]).extractReceipt(input),
    receipt
  );
  assert.deepEqual(models, ["primary", "fallback"]);
});

test("an error inside a 200 response is treated as a failure, not as a receipt", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () =>
    ++calls === 1
      ? Response.json({ error: { code: 502, message: "Provider returned error" } })
      : completion(JSON.stringify(receipt))
  );
  assert.deepEqual(await new OpenRouterClient("test-key").extractReceipt(input), receipt);
  assert.equal(calls, 2);
});

test("an empty 200 from one model is retried on the next", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () =>
    ++calls === 1 ? completion("") : completion(JSON.stringify(receipt))
  );
  assert.deepEqual(await new OpenRouterClient("test-key").extractReceipt(input), receipt);
  assert.equal(calls, 2);
});

test("a bad OpenRouter key or empty balance fails at once and names no provider", async (t) => {
  for (const status of [401, 402]) {
    let calls = 0;
    const fetchMock = t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return Response.json({ error: { code: status, message: "denied" } }, { status });
    });
    let failure: AppError | undefined;
    await assert.rejects(new OpenRouterClient("test-key").extractReceipt(input), (err: unknown) => {
      assert.ok(err instanceof AppError);
      failure = err;
      return true;
    });
    assert.equal(calls, 1);
    assert.ok(failure);
    assert.equal(failure.code, "LLM_FAILED");
    assert.doesNotMatch(mapErrorMessage(failure), /OpenRouter|denied|40[12]/);
    fetchMock.mock.restore();
  }
});

test("JSON wrapped in a markdown fence is still read", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    completion("```json\n" + JSON.stringify(receipt) + "\n```")
  );
  assert.deepEqual(await new OpenRouterClient("test-key").extractReceipt(input), receipt);
});

test("a model that cannot run without reasoning is asked again on its default", async (t) => {
  const reasoningSent: unknown[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const { reasoning } = sentBody(init);
    reasoningSent.push(reasoning);
    return reasoning
      ? Response.json(
          { error: { code: 400, message: "Reasoning is mandatory for this endpoint and cannot be disabled." } },
          { status: 400 }
        )
      : completion(JSON.stringify(receipt));
  });
  assert.deepEqual(await new OpenRouterClient("test-key", ["only"]).extractReceipt(input), receipt);
  assert.deepEqual(reasoningSent, [{ effort: "none" }, undefined]);
});

test("a model id OpenRouter rejects does not stop the fallback being tried", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback: () => void) => callback());
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) =>
    sentBody(init).model === "retired"
      ? Response.json({ error: { code: 400, message: "retired is not a valid model ID" } }, { status: 400 })
      : completion(JSON.stringify(receipt))
  );
  assert.deepEqual(
    await new OpenRouterClient("test-key", ["retired", "fallback"]).extractReceipt(input),
    receipt
  );
});
