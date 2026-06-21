/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from "@google/genai";
import { Fact, EdgeType, VectorArray } from "./types.js";
import { queryTeacher } from "./provider.js";
import { KnowledgeGraph } from "./knowledge.js";
import { normalizeUserInput } from "./normalization.js";

const factExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    facts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING, description: "A simple lowercase concept node representing the subject (e.g. 'python')" },
          predicate: { 
            type: Type.STRING, 
            description: "Strictly one of: 'is_a', 'related_to', 'causes', 'requires', 'similar_to', 'opposite_of', 'created_by', 'instance_of', 'part_of'" 
          },
          object: { type: Type.STRING, description: "Concept node or literal value representing the object (e.g. 'guido van rossum')" },
          rawSource: { type: Type.STRING, description: "Exact phrase or clause stating the fact" },
          confidence: { type: Type.NUMBER, description: "Estimated subjective confidence weight between 0.0 and 1.0 based on wording certainty" },
          context: { type: Type.STRING, description: "Thematic domain (e.g. programming, biography, transport)" }
        },
        required: ["subject", "predicate", "object", "rawSource", "confidence", "context"]
      }
    }
  },
  required: ["facts"]
};

export class LearningSystem {
  public facts: Fact[] = [];
  public conflicts: Array<{ existing: Fact; incoming: Fact; resolved: boolean; winnerId?: string }> = [];

  constructor() {}

  /**
   * Processes a conversation turn, extracts facts, checks for conflicts, and updates the Knowledge Graph.
   */
  public async learnFromTurn(
    userInput: string,
    response: string,
    graph: KnowledgeGraph
  ): Promise<Fact[]> {
    const context = `User said: "${userInput}". System responded: "${response}"`;
    const prompt = `Review the conversation below and extract any clear, factual assertions about concepts, developers, objects, logic, or processes. 
Do not extract transient personal chat context (like "the user is bored"). 
Only extract firm facts, synonyms, dependencies, or class structures.

Conversation context:
${context}`;

    const newFacts: Fact[] = [];

    try {
      const jsonStr = await queryTeacher(
        prompt,
        "You are the Fact Extraction unit of the Stellight Sentelum Engine. Output extracted facts in strict JSON format matching the schema.",
        factExtractionSchema
      );

      const parsed = JSON.parse(jsonStr) as { facts: any[] };
      if (!parsed.facts || !Array.isArray(parsed.facts)) return [];

      for (const extracted of parsed.facts) {
        const fact: Fact = {
          id: "fa_" + Math.random().toString(36).substring(2, 11),
          subject: extracted.subject.toLowerCase().trim(),
          predicate: extracted.predicate.toLowerCase().trim(),
          object: extracted.object.toLowerCase().trim(),
          rawSource: extracted.rawSource,
          confidence: Math.max(0.1, Math.min(1.0, extracted.confidence)),
          sourceCount: 1,
          lastVerified: Date.now(),
          context: extracted.context || "general"
        };

        // Validate facts and integrate them
        const processedFact = await this.integrateFact(fact, graph);
        if (processedFact) {
          newFacts.push(processedFact);
        }
      }
    } catch (err) {
      console.error("Fact extraction parsing failed, skipping reinforcement.", err);
    }

    return newFacts;
  }

  /**
   * Inserts the fact, manages conflict resolution, and builds Graph nodes/edges dynamically.
   */
  private async integrateFact(fact: Fact, graph: KnowledgeGraph): Promise<Fact | null> {
    // 1. Check for duplicate fact (same subject, predicate, object)
    const existingIndex = this.facts.findIndex(
      f => f.subject === fact.subject && f.predicate === fact.predicate && f.object === fact.object
    );

    if (existingIndex !== -1) {
      const existing = this.facts[existingIndex];
      // Reinforce confidence
      existing.sourceCount += 1;
      existing.confidence = Math.min(1.0, existing.confidence + (1.0 - existing.confidence) * 0.2);
      existing.lastVerified = Date.now();
      
      // Update graph edge weight
      graph.addEdge(existing.subject, existing.object, existing.predicate as EdgeType, existing.confidence, existing.confidence);
      return existing;
    }

    // 2. Conflict Detection (same subject and predicate, but DIFFERENT object, e.g. creator of python is guido vs creator of python is bob)
    // Only detect conflicts for structural relational predicates like 'created_by', 'is_a', 'part_of', 'instance_of'
    const functionalPredicates = ["created_by", "is_a", "instance_of", "part_of"];
    if (functionalPredicates.includes(fact.predicate)) {
      const conflicting = this.facts.find(
        f => f.subject === fact.subject && f.predicate === fact.predicate && f.object !== fact.object
      );

      if (conflicting) {
        console.warn(`CONFLICT DETECTED: ${fact.subject} ${fact.predicate} is ${conflicting.object} vs ${fact.object}`);
        this.conflicts.push({
          existing: conflicting,
          incoming: fact,
          resolved: false
        });

        // Trigger autonomous conflict resolution using the Gemini Teacher
        const resolvedFact = await this.resolveConflict(conflicting, fact);
        if (resolvedFact) {
          // If the teacher chose the incoming fact, replace the conflicting one
          if (resolvedFact.object === fact.object) {
            const conflictPos = this.facts.indexOf(conflicting);
            if (conflictPos !== -1) {
              this.facts.splice(conflictPos, 1);
            }
            this.facts.push(resolvedFact);
            await this.instantiateGraphComponents(resolvedFact, graph);
            return resolvedFact;
          } else {
            // The existing fact won. Reinforce confidence of existing
            conflicting.confidence = resolvedFact.confidence;
            return conflicting;
          }
        }
        return null;
      }
    }

    // 3. Brand new fact - integrate
    this.facts.push(fact);
    await this.instantiateGraphComponents(fact, graph);
    return fact;
  }

  /**
   * Automatically normalizes unknown concepts and updates Graph Nodes & Edges.
   */
  private async instantiateGraphComponents(fact: Fact, graph: KnowledgeGraph) {
    let srcNode = graph.nodes.get(fact.subject);
    let tgtNode = graph.nodes.get(fact.object);

    if (!srcNode) {
      // Perform dynamic normalization to extract a true vector representation
      const normInput = await normalizeUserInput(fact.subject);
      srcNode = graph.addOrUpdateNode(fact.subject, fact.subject, normInput.estimatedVector, {
        topic: fact.context,
        confidence: fact.confidence,
        tags: [fact.context]
      });
    }

    if (!tgtNode) {
      // Perform dynamic normalization for object as well
      const normInput = await normalizeUserInput(fact.object);
      tgtNode = graph.addOrUpdateNode(fact.object, fact.object, normInput.estimatedVector, {
        topic: fact.context,
        confidence: fact.confidence,
        tags: [fact.context]
      });
    }

    // Add Edge representing predicate
    const validPredicates: EdgeType[] = [
      "is_a", "related_to", "causes", "requires", "similar_to", "opposite_of", "created_by", "instance_of", "part_of"
    ];
    const edgeType = validPredicates.includes(fact.predicate as any) ? (fact.predicate as EdgeType) : "related_to";

    graph.addEdge(fact.subject, fact.object, edgeType, fact.confidence, fact.confidence);
  }

  /**
   * Resolves conceptual contradictions based on teacher consultation.
   */
  private async resolveConflict(existing: Fact, incoming: Fact): Promise<Fact | null> {
    const prompt = `Solve a conceptual/factual contradiction in my cognitive knowledge graph! For context type: "${existing.context}".
Existing Stored Fact: Subject [${existing.subject}] predicate [${existing.predicate}] is Object [${existing.object}] (Confidence ${existing.confidence}).
New Counter Assertion: Subject [${incoming.subject}] predicate [${incoming.predicate}] is Object [${incoming.object}] (Confidence ${incoming.confidence}).

Analyze which is true. Output your verdict in strict JSON:
{
  "winner": "existing" | "incoming",
  "reason": "Brief human explanation",
  "confidence": 0.0 to 1.0
}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        winner: { type: Type.STRING, enum: ["existing", "incoming"] },
        reason: { type: Type.STRING },
        confidence: { type: Type.NUMBER }
      },
      required: ["winner", "reason", "confidence"]
    };

    try {
      const jsonStr = await queryTeacher(
        prompt,
        "You are the Conflict Resolution unit of the Stellight Sentelum Engine. Carefully ground assertions to determine the truthful winner.",
        schema
      );

      const resolution = JSON.parse(jsonStr);
      const conflictItem = this.conflicts.find(c => c.existing.id === existing.id && c.incoming.id === incoming.id);
      if (conflictItem) {
        conflictItem.resolved = true;
        conflictItem.winnerId = resolution.winner === "incoming" ? incoming.id : existing.id;
      }

      console.log(`RESOURCE CONFLICT SOLVED: Winner is ${resolution.winner}. Reason: ${resolution.reason}`);

      if (resolution.winner === "incoming") {
        incoming.confidence = resolution.confidence;
        return incoming;
      } else {
        existing.confidence = resolution.confidence;
        return existing;
      }
    } catch (err) {
      console.error("Contradiction resolution failed, default to existing fact.", err);
      return existing;
    }
  }
}
