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
        "You are the Fact Extraction unit of the Starlight AI Engine. Output extracted facts in strict JSON format matching the schema.",
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

        // Add to conflicts but do NOT auto-resolve instantly. Leave for manual or explicit AI solve.
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
   * Applies the determined factual winner and embeds it mechanically into the knowledge graph
   */
  public async applyConflictResolution(
    existingId: string, 
    incomingId: string, 
    winner: "existing" | "incoming", 
    graph: KnowledgeGraph,
    confidenceOverride?: number
  ) {
    const conflictIndex = this.conflicts.findIndex(c => c.existing.id === existingId && c.incoming.id === incomingId);
    if (conflictIndex === -1) return null;

    const conflict = this.conflicts[conflictIndex];
    conflict.resolved = true;
    conflict.winnerId = winner === "incoming" ? conflict.incoming.id : conflict.existing.id;

    if (winner === "incoming") {
      const incomingFact = conflict.incoming;
      if (typeof confidenceOverride === "number") incomingFact.confidence = confidenceOverride;
      
      const factPos = this.facts.indexOf(conflict.existing);
      if (factPos !== -1) {
        this.facts.splice(factPos, 1);
      }
      this.facts.push(incomingFact);
      await this.instantiateGraphComponents(incomingFact, graph);
      return incomingFact;
    } else {
      const existingFact = conflict.existing;
      if (typeof confidenceOverride === "number") existingFact.confidence = confidenceOverride;
      return existingFact;
    }
  }

  /**
   * Resolves conceptual contradictions based on teacher consultation.
   */
  public async resolveConflictAutonomous(existingId: string, incomingId: string, graph: KnowledgeGraph): Promise<Fact | null> {
    const conflict = this.conflicts.find(c => c.existing.id === existingId && c.incoming.id === incomingId);
    if (!conflict) return null;

    const existing = conflict.existing;
    const incoming = conflict.incoming;

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
        "You are the Conflict Resolution unit of the Starlight AI Engine. Carefully ground assertions to determine the truthful winner.",
        schema
      );

      const resolution = JSON.parse(jsonStr);
      const conflictItem = this.conflicts.find(c => c.existing.id === existing.id && c.incoming.id === incoming.id);
      if (conflictItem) {
        conflictItem.resolved = true;
        conflictItem.winnerId = resolution.winner === "incoming" ? incoming.id : existing.id;
      }

      console.log(`RESOURCE CONFLICT SOLVED: Winner is ${resolution.winner}. Reason: ${resolution.reason}`);

      return await this.applyConflictResolution(existingId, incomingId, resolution.winner, graph, resolution.confidence);
    } catch (err) {
      console.error("Contradiction resolution failed, default to existing fact.", err);
      // Let it pend instead of resolving default? No, wait. 
      return existing;
    }
  }

  /**
   * Executes 5 complementary cognitive learning algorithms to reorganize, optimize, and synthesize relations
   */
  public runAdvancedLearningHeuristics(graph: KnowledgeGraph): {
    deductiveLearned: number;
    inductiveLearned: number;
    entropyPruned: number;
    analogiesMapped: number;
    densityStrengthened: number;
    heuristicLogs: string[];
  } {
    const logs: string[] = [];
    let deductiveCount = 0;
    let inductiveCount = 0;
    let pruneCount = 0;
    let analogyCount = 0;
    let densityCount = 0;

    // --- METHOD 1: Deductive Syllogistic Learning (Transitive Inference) ---
    // If A is_a B, and B is_a C, deduce that A is_a C (if it doesn't already exist)
    const isA_relations = this.facts.filter(f => f.predicate === "is_a");
    for (const fact1 of isA_relations) {
      for (const fact2 of isA_relations) {
        if (fact1.object === fact2.subject && fact1.subject !== fact2.object) {
          const exists = this.facts.some(
            f => f.subject === fact1.subject && f.predicate === "is_a" && f.object === fact2.object
          );
          if (!exists) {
            const confidence = Math.min(0.95, fact1.confidence * fact2.confidence * 0.9);
            const deducedFact: Fact = {
              id: "fa_ded_" + Math.random().toString(36).substring(2, 11),
              subject: fact1.subject,
              predicate: "is_a",
              object: fact2.object,
              rawSource: `Syllogistic Deduction: Derived transitively from [${fact1.subject} is_a ${fact1.object}] and [${fact2.subject} is_a ${fact2.object}]`,
              confidence,
              sourceCount: 1,
              lastVerified: Date.now(),
              context: fact1.context || "deductive-logic"
            };
            this.facts.push(deducedFact);
            deductiveCount++;
            logs.push(`[Deduction] Extrapolated connection: ${fact1.subject} -> is_a -> ${fact2.object}`);
          }
        }
      }
    }

    // --- METHOD 2: Inductive Concept Generalization ---
    // If multiple nodes in the same context maps to same object via same predicate, generalize their context category.
    const contextGroups: { [key: string]: Fact[] } = {};
    for (const f of this.facts) {
      if (f.context) {
        if (!contextGroups[f.context]) contextGroups[f.context] = [];
        contextGroups[f.context].push(f);
      }
    }
    for (const [ctx, group] of Object.entries(contextGroups)) {
      if (group.length >= 3) {
        // Group has multiple facts. Let's find common denominators.
        const targets = group.map(f => f.object);
        const uniqueTargets = Array.from(new Set(targets));
        for (const tgt of uniqueTargets) {
          const occ = group.filter(f => f.object === tgt);
          if (occ.length >= 2 && occ.some(o => o.predicate === "is_a")) {
            const exists = this.facts.some(f => f.subject === ctx && f.predicate === "related_to" && f.object === tgt);
            if (!exists && ctx && tgt) {
              const generalization: Fact = {
                id: "fa_ind_" + Math.random().toString(36).substring(2, 11),
                subject: ctx.toLowerCase(),
                predicate: "related_to",
                object: tgt.toLowerCase(),
                rawSource: `Inductive Generalization: Context sector [${ctx}] shows high density connection with [${tgt}]`,
                confidence: 0.85,
                sourceCount: 1,
                lastVerified: Date.now(),
                context: "inductive-learning"
              };
              this.facts.push(generalization);
              inductiveCount++;
              logs.push(`[Inductive Category] Grouped context segment "${ctx}" -> related_to -> "${tgt}"`);
            }
          }
        }
      }
    }

    // --- METHOD 3: Contradiction & Entropy Pruning ---
    // If two items conflict but haven't been processed by the teacher yet (or have low confidence),
    // we resolve this automatically by keeping the higher confidence and downgrading heretic noise.
    const uniqueSubjectPredicates = Array.from(new Set(this.facts.map(f => `${f.subject}::${f.predicate}`)));
    for (const sp of uniqueSubjectPredicates) {
      const [subject, predicate] = sp.split("::");
      const subFacts = this.facts.filter(f => f.subject === subject && f.predicate === predicate);
      if (subFacts.length > 1 && ["created_by", "is_a", "instance_of"].includes(predicate)) {
        subFacts.sort((a, b) => b.confidence - a.confidence);
        const winner = subFacts[0];
        for (let i = 1; i < subFacts.length; i++) {
          const loser = subFacts[i];
          if (winner.confidence - loser.confidence > 0.15) {
            logs.push(`[Entropy Pruning] Resolved clash of "${subject} ${predicate}": favoring "${winner.object}" (${winner.confidence.toFixed(2)}) over lower confidence "${loser.object}" (${loser.confidence.toFixed(2)}). Pruned anomaly.`);
            const idx = this.facts.indexOf(loser);
            if (idx !== -1) {
              this.facts.splice(idx, 1);
            }
            pruneCount++;
          }
        }
      }
    }

    // --- METHOD 4: Analogical Alignment Mapping ---
    // Search for mapping alignment (A is to B as C is to D)
    for (let i = 0; i < this.facts.length; i++) {
      for (let j = i + 1; j < this.facts.length; j++) {
        const f1 = this.facts[i];
        const f2 = this.facts[j];
        if (f1.predicate === f2.predicate && f1.subject !== f2.subject && f1.object !== f2.object) {
          if (f1.context === f2.context && f1.context !== "general" && f1.context !== "manual") {
            const exists = this.facts.some(
              f => (f.subject === f1.subject && f.object === f2.subject) || (f.subject === f2.subject && f.object === f1.subject)
            );
            if (!exists) {
              const analogyFact: Fact = {
                id: "fa_ana_" + Math.random().toString(36).substring(2, 11),
                subject: f1.subject,
                predicate: "similar_to",
                object: f2.subject,
                rawSource: `Analogical Mapping: subjects share predicate [${f1.predicate}] inside domain [${f1.context}]`,
                confidence: 0.82,
                sourceCount: 1,
                lastVerified: Date.now(),
                context: "analogical-alignment"
              };
              this.facts.push(analogyFact);
              analogyCount++;
              logs.push(`[Analogy Alignment] Aligned similar concepts: "${f1.subject}" similarity discovered with "${f2.subject}"`);
            }
          }
        }
      }
    }

    // --- METHOD 5: Co-occurrence Density Weighting ---
    const nodesInGraph = Array.from(graph.nodes.keys());
    for (const nodeKey of nodesInGraph) {
      const occurrences = this.facts.filter(f => f.subject === nodeKey || f.object === nodeKey);
      if (occurrences.length >= 3) {
        const srcNode = graph.nodes.get(nodeKey);
        if (srcNode) {
          srcNode.importance = Math.min(1.0, srcNode.importance + 0.12);
          densityCount++;
        }
      }
    }

    // Re-instantiate everything newly created to current Graph
    for (const f of this.facts) {
      if (f.id.startsWith("fa_ded_") || f.id.startsWith("fa_ind_") || f.id.startsWith("fa_ana_")) {
        this.instantiateGraphComponents(f, graph);
      }
    }

    return {
      deductiveLearned: deductiveCount,
      inductiveLearned: inductiveCount,
      entropyPruned: pruneCount,
      analogiesMapped: analogyCount,
      densityStrengthened: densityCount,
      heuristicLogs: logs
    };
  }
}
