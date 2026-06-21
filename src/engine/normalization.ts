/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from "@google/genai";
import { NormalizedInput } from "./types.js";
import { queryTeacher } from "./provider.js";

const normalizationSchema = {
  type: Type.OBJECT,
  properties: {
    raw: { type: Type.STRING },
    normalizedText: { type: Type.STRING, description: "Cleaned up spelling-corrected lowercase text representation" },
    intent: { 
      type: Type.STRING, 
      enum: ["question", "statement", "correction", "greeting", "opinion", "unknown"] 
    },
    primaryConcept: { type: Type.STRING, description: "The most central lowercase noun/concept (e.g. 'car', 'python', 'logic')" },
    synonyms: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "Direct synonyms (e.g. ['automobile', 'vehicle'] for 'car')" 
    },
    topic: { type: Type.STRING, description: "Thematic category (e.g., transportation, programming, philosophy)" },
    entities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Named key nouns, characters or modules involved" },
    emotions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Detected user emotions (e.g., curious, confused, collaborative)" },
    contextTags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Context tags summarizing current ambient context" },
    estimatedVector: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "A 16-element array where each index is 0.0 to 1.0 representing vector weights for dimensions: [PHYSICAL, DIGITAL, ABSTRACT, BIOLOGICAL, MECHANICAL, TRANSPORT, COGNITIVE, CREATIVE, TEMPORAL, SOCIAL, SCIENTIFIC, LANGUAGE, CREATOR, TOOL, PROCESS, QUANTITATIVE]"
    }
  },
  required: ["raw", "normalizedText", "intent", "primaryConcept", "synonyms", "topic", "entities", "emotions", "contextTags", "estimatedVector"]
};

/**
 * Normalizes input text into a high-fidelity cognitive package.
 */
export async function normalizeUserInput(input: string): Promise<NormalizedInput> {
  const normalizedText = input.toLowerCase().trim();
  const prompt = `Analyze and normalize the following input text for a cognitive architecture: "${input}". 
Estimate a 16-dimensional semantic vector representing its primary concept in the specified order. 
Be rigorous and proportional with the vector weights (use values between 0.0 and 1.0, e.g. a digital logic concept has high DIGITAL, ABSTRACT, and COGNITIVE weights but near zero PHYSICAL and BIOLOGICAL weights).`;

  try {
    const jsonStr = await queryTeacher(
      prompt,
      `You are the Input Normalizer of the Stellight Sentelum Engine. You normalize text, extract intent and concepts, and represent them in a strict 16-D vector space.`,
      normalizationSchema
    );

    const parsed = JSON.parse(jsonStr) as NormalizedInput;
    // Post-processing safety verification
    if (!parsed.estimatedVector || parsed.estimatedVector.length !== 16) {
      parsed.estimatedVector = Array(16).fill(0.1);
    }
    // Clean concept
    parsed.primaryConcept = parsed.primaryConcept.toLowerCase().trim();
    if (!parsed.synonyms.includes(parsed.primaryConcept)) {
      parsed.synonyms.unshift(parsed.primaryConcept);
    }
    return parsed;
  } catch (err) {
    console.error("Input normalization failed, creating standard fallback package.", err);
    return {
      raw: input,
      normalizedText,
      intent: "unknown",
      primaryConcept: normalizedText.split(" ")[0] || "concept",
      synonyms: [],
      topic: "general",
      entities: [],
      emotions: ["neutral"],
      contextTags: [],
      estimatedVector: Array(16).fill(0.1)
    };
  }
}
