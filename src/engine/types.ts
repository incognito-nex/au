/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Dimension indices and labels for the 16-D Sentelum Vector Space
export const VECTOR_DIMENSIONS = [
  "PHYSICAL",     // 0: structural, tactile, tangible
  "DIGITAL",      // 1: virtual, code, internet, software
  "ABSTRACT",     // 2: theory, logic, mathematics, philosophy
  "BIOLOGICAL",   // 3: flora, fauna, organic life
  "MECHANICAL",   // 4: engines, machines, hardware, kinetic
  "TRANSPORT",    // 5: logistics, vehicles, travel, movement
  "COGNITIVE",    // 6: intelligence, knowledge, learning, brain
  "CREATIVE",     // 7: art, music, design, expression
  "TEMPORAL",     // 8: time, historic events, epochs, cycles
  "SOCIAL",       // 9: community, relationships, civilization, people
  "SCIENTIFIC",   // 10: physics, chemistry, geology, science laws
  "LANGUAGE",     // 11: syntax, words, protocols, coding syntax
  "CREATOR",      // 12: authors, builders, inventors, founders
  "TOOL",         // 13: utensils, compilers, software, instruments
  "PROCESS",      // 14: tasks, operations, sequences, flowcharts
  "QUANTITATIVE"  // 15: metric, volume, scale, cost, mass
] as const;

export type VectorArray = number[]; // Strictly 16 numbers between 0.0 and 1.0

export type IntentType = "question" | "statement" | "correction" | "greeting" | "opinion" | "unknown";

export interface NormalizedInput {
  raw: string;
  normalizedText: string;
  intent: IntentType;
  primaryConcept: string;
  synonyms: string[];
  topic: string;
  entities: string[];
  emotions: string[];
  contextTags: string[];
  estimatedVector: VectorArray;
}

export type EdgeType = 
  | "is_a" 
  | "related_to" 
  | "causes" 
  | "requires" 
  | "similar_to" 
  | "opposite_of" 
  | "created_by" 
  | "instance_of"
  | "part_of";

export interface Node {
  id: string; // The primary concept key, lowercase, e.g., "python"
  label: string; // Display name, e.g., "Python"
  vector: VectorArray;
  importance: number; // 0.0 to 1.0, based on connections, frequency, recency
  usageFrequency: number;
  lastAccessed: number; // Unix timestamp
  metadata: Record<string, any>;
}

export interface Edge {
  source: string; // Node ID
  target: string; // Node ID
  type: EdgeType;
  weight: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  created: number;
}

export interface Fact {
  id: string; // Unique digest or id
  subject: string; // Node ID (or concept)
  predicate: string; // e.g. "creator", "created_by", "requires"
  object: string; // Node ID or literal value
  rawSource: string; // Phrase it was extracted from
  confidence: number; // 0.0 to 1.0
  sourceCount: number; // For reinforcement
  lastVerified: number;
  context: string; // Context tag or topic
}

export interface MemoryChunk {
  id: string;
  type: "short" | "episodic" | "semantic";
  content: string;
  concepts: string[];
  valence: number; // -1.0 (negative) to 1.0 (positive)
  confidence: number;
  importance: number;
  recency: number; // Decay multiplier
  timestamp: number;
}

export interface SystemMetrics {
  totalInteractions: number;
  learnedFacts: number;
  averageConfidence: number;
  correctionsCount: number;
  mistakesResolved: number;
  retrievalSuccessCount: number;
}

export interface ReasoningStep {
  name: string; // e.g., "Understanding", "Memory Retrieval", "Knowledge Expansion", "Reasoning Matrix", "Generation"
  description: string;
  details: any;
}

export interface ReasoningTrace {
  input: string;
  normalized: NormalizedInput;
  steps: ReasoningStep[];
  retrievedNodes: Node[];
  retrievedEdges: Edge[];
  retrievedFacts: Fact[];
  confidence: number; // Overall response confidence
  response: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
