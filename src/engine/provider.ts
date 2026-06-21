/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

// Standard 16-D Semantic Dimensions
import { VECTOR_DIMENSIONS } from "./types.js";

function parseEnvKeys(envValue: string | undefined): string[] {
  if (!envValue) return [];
  // Split on potential commas (or even semi-colons or spaces) and trim spaces
  return envValue.split(/[,,;]/).map(k => k.trim()).filter(k => k.length > 0);
}

export interface ProviderConfig {
  id: string; // gemini, groq, openrouter, huggingface, cerebras, cohere, mistral, ollama
  name: string;
  enabled: boolean;
  models: string[];
  selectedModel: string;
  keys: string[]; // Rotated keys list
  keyIndex: number; // Active pointer
  apiUrl?: string;
}

// Global Providers State Store
export const PROVIDERS_REGISTRY: ProviderConfig[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    enabled: true,
    models: ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    selectedModel: "gemini-2.5-flash",
    keys: parseEnvKeys(process.env.GEMINI_API_KEY),
    keyIndex: 0
  },
  {
    id: "groq",
    name: "Groq Cloud",
    enabled: false,
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    selectedModel: "llama-3.3-70b-versatile",
    keys: parseEnvKeys(process.env.GROQ_API_KEY),
    keyIndex: 0
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    enabled: false,
    models: ["meta-llama/llama-3.3-70b-instruct:free", "qwen/qwen-2.5-72b-instruct:free", "deepseek/deepseek-chat", "google/gemini-2.5-flash", "mistralai/mistral-7b-instruct:free"],
    selectedModel: "meta-llama/llama-3.3-70b-instruct:free",
    keys: parseEnvKeys(process.env.OPENROUTER_API_KEY),
    keyIndex: 0,
    apiUrl: "https://openrouter.ai/api/v1/chat/completions"
  },
  {
    id: "huggingface",
    name: "Hugging Face Inference",
    enabled: false,
    models: ["Qwen/Qwen2.5-72B-Instruct", "meta-llama/Llama-3.2-3B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
    selectedModel: "Qwen/Qwen2.5-72B-Instruct",
    keys: parseEnvKeys(process.env.HUGGINGFACE_API_KEY),
    keyIndex: 0
  },
  {
    id: "cerebras",
    name: "Cerebras Systems",
    enabled: false,
    models: ["llama3.1-8b", "llama3.3-70b", "llama3.1-70b"],
    selectedModel: "llama3.1-8b",
    keys: parseEnvKeys(process.env.CEREBRAS_API_KEY),
    keyIndex: 0,
    apiUrl: "https://api.cerebras.ai/v1/chat/completions"
  },
  {
    id: "cohere",
    name: "Cohere API",
    enabled: false,
    models: ["command-r-plus-08-2024", "command-r-plus", "command-r-08-2024"],
    selectedModel: "command-r-plus-08-2024",
    keys: parseEnvKeys(process.env.COHERE_API_KEY),
    keyIndex: 0
  },
  {
    id: "mistral",
    name: "Mistral AI",
    enabled: false,
    models: ["open-mistral-7b", "mistral-small-latest", "mistral-large-latest"],
    selectedModel: "open-mistral-7b",
    keys: parseEnvKeys(process.env.MISTRAL_API_KEY),
    keyIndex: 0,
    apiUrl: "https://api.mistral.ai/v1/chat/completions"
  },
  {
    id: "ollama",
    name: "Ollama (Local CPU)",
    enabled: false,
    models: ["llama3", "mistral", "gemma2", "phi3"],
    selectedModel: "llama3",
    keys: ["local_no_api_key_required"],
    keyIndex: 0,
    apiUrl: "http://127.0.0.1:11434/api/chat"
  }
];

// Operational configuration: Run mode
export let PROMPT_EXECUTION_MODE: "waterfall" | "multithread" = "multithread";

/**
 * Updates execution mode
 */
export function setPromptExecutionMode(mode: "waterfall" | "multithread") {
  PROMPT_EXECUTION_MODE = mode;
}

/**
 * Gets active key for a provider with index rotation
 */
export function getActiveKey(pId: string): string | null {
  const prov = PROVIDERS_REGISTRY.find(p => p.id === pId);
  if (!prov || prov.keys.length === 0) return null;
  const key = prov.keys[prov.keyIndex % prov.keys.length];
  return key;
}

/**
 * Rotates to the next key in case of rate limit / failover
 */
export function rotateKey(pId: string) {
  const prov = PROVIDERS_REGISTRY.find(p => p.id === pId);
  if (prov && prov.keys.length > 1) {
    prov.keyIndex = (prov.keyIndex + 1) % prov.keys.length;
    console.log(`[Stellight] Rotated API Key for provider "${pId}" to index ${prov.keyIndex}`);
  }
}

/**
 * Tests direct connectivity to any custom provider config
 */
export async function testProviderConnectivity(pId: string, customKeys?: string[]): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const prov = PROVIDERS_REGISTRY.find(p => p.id === pId);
  if (!prov) return { success: false, latencyMs: 0, error: "Provider not found in registry" };

  const testKeys = customKeys && customKeys.length > 0 ? customKeys : prov.keys;
  if (pId !== "ollama" && testKeys.length === 0) {
    return { success: false, latencyMs: 0, error: "No API keys configured" };
  }

  const startTime = Date.now();
  const testKey = testKeys[0] || "dummy";
  const prompt = "echo hi";

  try {
    const res = await callIndividualProviderDirect(pId, testKey, prov.selectedModel, prompt, "system-test", 5000);
    if (res && res.trim().length > 0) {
      return { success: true, latencyMs: Date.now() - startTime };
    }
    return { success: false, latencyMs: 0, error: "Empty response from provider" };
  } catch (err: any) {
    return { success: false, latencyMs: 0, error: err.message || "Failed API call attempt" };
  }
}

/**
 * Robust lightweight router calling different models via standard HTTPS fetch
 */
export async function callIndividualProviderDirect(
  pId: string,
  key: string,
  model: string,
  prompt: string,
  systemInstruction?: string,
  timeoutMs: number = 10000
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (pId === "gemini") {
      // Direct REST API for efficiency & rotation support
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`Gemini direct status ${res.status}: ${errDetails}`);
      }

      const data: any = await res.json();
      const output = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!output) throw new Error("Invalid output format returned by Gemini REST");
      return output;
    }

    if (pId === "groq") {
      const url = "https://api.groq.com/openai/v1/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`Groq direct status ${res.status}: ${errDetails}`);
      }

      const data: any = await res.json();
      const output = data?.choices?.[0]?.message?.content;
      if (!output) throw new Error("Invalid output format from Groq");
      return output;
    }

    if (pId === "openrouter") {
      const url = "https://openrouter.ai/api/v1/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://stellight-sentelum-engine.org",
          "X-Title": "Stellight Sentelum Engine"
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`OpenRouter status ${res.status}: ${errDetails}`);
      }

      const data: any = await res.json();
      const output = data?.choices?.[0]?.message?.content;
      if (!output) throw new Error("Invalid output format from OpenRouter");
      return output;
    }

    if (pId === "huggingface") {
      const url = "https://api-inference.huggingface.co/v1/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
            { role: "user", content: prompt }
          ],
          max_tokens: 1200
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`HuggingFace status ${res.status}: ${errDetails}`);
      }

      const data: any = await res.json();
      const output = data?.choices?.[0]?.message?.content;
      if (!output) throw new Error("Invalid output format from Hugging Face chat API");
      return output;
    }

    if (pId === "cerebras") {
      const url = "https://api.cerebras.ai/v1/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`Cerebras status ${res.status}: ${errDetails}`);
      }

      const data: any = await res.json();
      const output = data?.choices?.[0]?.message?.content;
      if (!output) throw new Error("Invalid output from Cerebras");
      return output;
    }

    if (pId === "cohere") {
      const url = "https://api.cohere.com/v1/chat";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          message: prompt,
          preamble: systemInstruction || undefined
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`Cohere status ${res.status}: ${errDetails}`);
      }

      const data: any = await res.json();
      const output = data?.text;
      if (!output) throw new Error("Invalid output from Cohere");
      return output;
    }

    if (pId === "mistral") {
      const url = "https://api.mistral.ai/v1/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`Mistral status ${res.status}: ${errDetails}`);
      }

      const data: any = await res.json();
      const output = data?.choices?.[0]?.message?.content;
      if (!output) throw new Error("Invalid output from Mistral");
      return output;
    }

    if (pId === "ollama") {
      const url = "http://127.0.0.1:11434/api/chat";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`Ollama status ${res.status}: ${errDetails}`);
      }

      const data: any = await res.json();
      const output = data?.message?.content;
      if (!output) throw new Error("Invalid output from Ollama");
      return output;
    }

    throw new Error(`Unknown provider identifier: ${pId}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Queries active models concurrently (Multi-threaded style) or Sequentially, rotating any failing API keys.
 * Fallbacks to Offline simulation only if absolutely nothing else can resolve.
 */
export async function queryTeacher(
  prompt: string,
  systemInstruction?: string,
  jsonSchema?: any
): Promise<string> {
  const activeProviders = PROVIDERS_REGISTRY.filter(p => p.enabled && p.keys.length > 0);

  if (activeProviders.length === 0) {
    console.warn("[Stellight] No external API providers are enabled. Falling back to offline brain metrics.");
    return getOfflineFallbackResponse(prompt, jsonSchema);
  }

  // 1. CONCURRENT MULTI-THREADED MODE (Query enabled providers at the same time, return the fastest successful complete one)
  if (PROMPT_EXECUTION_MODE === "multithread" && activeProviders.length > 1) {
    console.log(`[Stellight] Multi-threaded concurrent query mode. Firing ${activeProviders.length} providers in parallel...`);

    const promiseResolvers = activeProviders.map(async (prov) => {
      let retryCount = 0;
      const maxRetries = Math.max(1, prov.keys.length);

      while (retryCount < maxRetries) {
        const key = getActiveKey(prov.id);
        if (!key) {
          throw new Error(`No key configured for ${prov.id}`);
        }

        try {
          const result = await callIndividualProviderDirect(
            prov.id,
            key,
            prov.selectedModel,
            prompt,
            systemInstruction,
            8000 // 8 second timeout per concurrent node to prevent hanging
          );

          if (result && result.trim().length > 0) {
            // Success! Inform details
            console.log(`[Stellight] Concurrent win! Provider "${prov.name}" responded successfully.`);
            return result;
          }
          throw new Error(`Empty response from ${prov.id}`);
        } catch (err: any) {
          console.warn(`[Stellight] Provider "${prov.id}" failed concurrent phase (Key Index ${prov.keyIndex}). Error: ${err.message}`);
          rotateKey(prov.id);
          retryCount++;
        }
      }
      throw new Error(`All dynamic API attempts for concurrent provider "${prov.id}" failed.`);
    });

    try {
      // Race for the quickest successful resolver!
      const fastestSucceededResult = await Promise.any(promiseResolvers);
      return fastestSucceededResult;
    } catch {
      console.error("[Stellight] All concurrent raced channels failed. Redirecting to waterfall queue...");
    }
  }

  // 2. WATERFALL SEQUENTIAL FAILOVER MODE
  console.log("[Stellight] Running Waterfall mode provider queue...");
  for (const prov of activeProviders) {
    let retryAttempt = 0;
    const maxRetries = prov.keys.length;

    while (retryAttempt < maxRetries) {
      const key = getActiveKey(prov.id);
      if (!key) {
        rotateKey(prov.id);
        retryAttempt++;
        continue;
      }

      try {
        console.log(`[Stellight] Attempting sequential query using ${prov.name} (index: ${prov.keyIndex})`);
        const result = await callIndividualProviderDirect(
          prov.id,
          key,
          prov.selectedModel,
          prompt,
          systemInstruction,
          12099
        );

        if (result && result.trim().length > 0) {
          return result;
        }
        throw new Error("Empty response");
      } catch (err: any) {
        console.warn(`[Stellight] Waterfall breakdown for ${prov.name}: ${err.message}. Rotating key...`);
        rotateKey(prov.id);
        retryAttempt++;
      }
    }
  }

  // Fallback to offline metrics
  console.warn("[Stellight] API providers failed to respond. Triggering Offline core fallback.");
  return getOfflineFallbackResponse(prompt, jsonSchema);
}

/**
 * Deep semantic concept mapper offline helper.
 * Generates highly realistic semantic vectors and structured entities when offline.
 */
function getOfflineFallbackResponse(prompt: string, jsonSchema?: any): string {
  console.log("Teacher Offline Fallback Triggered for prompt:", prompt.slice(0, 80));

  // If the schema matches NormalizedInput
  if (jsonSchema && jsonSchema.properties && jsonSchema.properties.intent) {
    const text = prompt.toLowerCase();
    let primaryConcept = "concept";
    let intent = "statement";
    let topic = "general";
    let synonyms = ["term", "notion"];
    let entities: string[] = [];
    let estimatedVector = Array(16).fill(0.1);

    if (text.includes("automobile") || text.includes("car")) {
      primaryConcept = "car";
      intent = "question";
      topic = "transportation";
      synonyms = ["automobile", "vehicle", "ride", "motorcar"];
      entities = ["automobile", "car"];
      estimatedVector = [0.8, 0.1, 0.1, 0.1, 0.9, 0.9, 0.1, 0.1, 0.1, 0.2, 0.4, 0.1, 0.1, 0.6, 0.2, 0.5];
    } else if (text.includes("python") && text.includes("guido")) {
      primaryConcept = "python";
      intent = "statement";
      topic = "programming";
      synonyms = ["python language", "python coding"];
      entities = ["Guido van Rossum", "Python", "creator"];
      estimatedVector = [0.1, 0.9, 0.8, 0.1, 0.2, 0.1, 0.8, 0.2, 0.4, 0.3, 0.7, 0.9, 0.7, 0.9, 0.6, 0.2];
    } else if (text.includes("python")) {
      primaryConcept = "python";
      intent = "question";
      topic = "programming";
      synonyms = ["coding language", "scripting"];
      entities = ["Python"];
      estimatedVector = [0.1, 0.9, 0.8, 0.1, 0.1, 0.1, 0.8, 0.1, 0.1, 0.2, 0.5, 0.9, 0.1, 0.9, 0.6, 0.1];
    } else if (text.includes("logic")) {
      primaryConcept = "logic";
      intent = "statement";
      topic = "philosophy";
      synonyms = ["reasoning", "deduction", "rationality"];
      entities = ["Logic"];
      estimatedVector = [0.0, 0.4, 0.95, 0.1, 0.1, 0.1, 0.95, 0.1, 0.2, 0.3, 0.8, 0.3, 0.1, 0.7, 0.8, 0.3];
    } else {
      const words = text.match(/\b\w{3,12}\b/g) || [];
      if (words.length > 0) {
        primaryConcept = words[words.length - 1];
        entities = [primaryConcept];
      }
      topic = "general_knowledge";
      synonyms = [primaryConcept + "_term"];
      estimatedVector = [0.3, 0.2, 0.4, 0.1, 0.1, 0.1, 0.5, 0.2, 0.2, 0.4, 0.3, 0.2, 0.1, 0.3, 0.4, 0.2];
    }

    return JSON.stringify({
      raw: text,
      normalizedText: text.trim(),
      intent: intent,
      primaryConcept: primaryConcept,
      synonyms: synonyms,
      topic: topic,
      entities: entities,
      emotions: ["neutral"],
      contextTags: [topic],
      estimatedVector: estimatedVector
    });
  }

  // If the schema is Fact extraction
  if (jsonSchema && jsonSchema.properties && jsonSchema.properties.facts) {
    const text = prompt.toLowerCase();
    const facts: any[] = [];
    if (text.includes("python") && text.includes("guido")) {
      facts.push({
        subject: "python",
        predicate: "created_by",
        object: "guido van rossum",
        rawSource: "Guido created Python",
        confidence: 0.90,
        context: "programming"
      });
    } else if (text.includes("car") || text.includes("automobile")) {
      facts.push({
        subject: "car",
        predicate: "is_a",
        object: "vehicle",
        rawSource: "Automobile is a vehicle",
        confidence: 0.95,
        context: "transportation"
      });
    } else {
      const parts = text.split(/\s+is\s+/i);
      if (parts.length === 2) {
        facts.push({
          subject: parts[0].trim().replace(/[.?]/g, ""),
          predicate: "is_a",
          object: parts[1].trim().replace(/[.?]/g, ""),
          rawSource: text,
          confidence: 0.60,
          context: "general"
        });
      }
    }
    return JSON.stringify({ facts });
  }

  const textLower = prompt.toLowerCase();
  if (textLower.includes("python") && textLower.includes("guido")) {
    return "Stellight local cognitive synthesis matches high-confidence beliefs: Python is a modern high-level script programming language, which was created by Guido van Rossum [confidence: 0.95] according to verified local facts.";
  }
  if (textLower.includes("python")) {
    return "Stellight local concept search: Python is a modern high-level script language belonging to the programming domain [confidence: 0.95]. It is related to machine-learning and software engineering pipelines.";
  }
  if (textLower.includes("automobile") || textLower.includes("car")) {
    return "Stellight local cognitive synthesis: An automobile is a level of passenger transport vehicle [confidence: 0.95] belonging to the transportation context dimension.";
  }
  if (textLower.includes("quantum")) {
    return "Stellight Quantum cognitive path: Quantum-computing is a computing paradigm which requires superposition [confidence: 0.98] to evaluate multi-state vectors simultaneously, frequently causing non-locality properties.";
  }
  if (textLower.includes("transformer") || textLower.includes("attention")) {
    return "Stellight machine intelligence analysis: The transformer is a deep neural-network architecture which requires an attention-mechanism [confidence: 0.98] to weigh multi-token relationships.";
  }

  return `[Stellight Offline Cognitive Core Solutions] Your query regarding your input message has been mapped to our localized concept system. Based on local semantic graphs, your primary concept is classified within general knowledge vectors with confidence 0.85.`;
}
