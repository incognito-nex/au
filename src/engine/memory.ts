/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryChunk, Node } from "./types.js";

export class CognitiveMemory {
  public shortTerm: MemoryChunk[] = [];
  public episodic: MemoryChunk[] = [];
  public semantic: MemoryChunk[] = [];

  private maxShortTermSize = 10;
  private maxEpisodicSize = 100;

  constructor() {}

  /**
   * Appends an entry into short term memory.
   */
  public addShortTerm(content: string, concepts: string[], valence = 0.0, importance = 0.5): MemoryChunk {
    const chunk: MemoryChunk = {
      id: "sh_" + Math.random().toString(36).substring(2, 11),
      type: "short",
      content,
      concepts,
      valence,
      confidence: 1.0,
      importance,
      recency: 1.0,
      timestamp: Date.now()
    };

    this.shortTerm.push(chunk);

    // Prune short-term memory to keep focus narrow
    if (this.shortTerm.length > this.maxShortTermSize) {
      const oldest = this.shortTerm.shift();
      if (oldest) {
        // Consolidate crucial short term memory into episodic memory
        this.addEpisodic(oldest.content, oldest.concepts, oldest.valence, oldest.importance * 0.8);
      }
    }

    return chunk;
  }

  /**
   * Appends an experience memory.
   */
  public addEpisodic(content: string, concepts: string[], valence = 0.0, importance = 0.5): MemoryChunk {
    const chunk: MemoryChunk = {
      id: "ep_" + Math.random().toString(36).substring(2, 11),
      type: "episodic",
      content,
      concepts,
      valence,
      confidence: 0.8,
      importance,
      recency: 1.0,
      timestamp: Date.now()
    };

    this.episodic.push(chunk);

    // Dynamic pruning and sorting of episodic memory
    if (this.episodic.length > this.maxEpisodicSize) {
      this.pruneEpisodicMemory();
    }

    return chunk;
  }

  /**
   * Adds general factual memory chunk.
   */
  public addSemantic(content: string, concepts: string[], confidence = 0.8, importance = 0.6): MemoryChunk {
    // Check for exact duplicate concept mappings
    const isDuplicate = this.semantic.some(
      s => s.content.toLowerCase().trim() === content.toLowerCase().trim()
    );

    if (isDuplicate) return this.semantic.find(s => s.content.toLowerCase().trim() === content.toLowerCase().trim())!;

    const chunk: MemoryChunk = {
      id: "se_" + Math.random().toString(36).substring(2, 11),
      type: "semantic",
      content,
      concepts,
      valence: 0.0,
      confidence,
      importance,
      recency: 1.0,
      timestamp: Date.now()
    };

    this.semantic.push(chunk);
    return chunk;
  }

  /**
   * Calculates overall importance/retention factor.
   * Compares importance rating with standard temporal decay factors.
   */
  public getMemoryRecallWeight(chunk: MemoryChunk): number {
    const hoursElapsed = (Date.now() - chunk.timestamp) / (1000 * 60 * 60);
    // Standard temporal memory retention rate (Ebbinghaus decay curve)
    const decay = Math.exp(-0.05 * hoursElapsed);
    return chunk.importance * 0.7 + decay * 0.3;
  }

  /**
   * Prunes low-importance memories to save index size.
   */
  private pruneEpisodicMemory() {
    // Sort by recall weight, drop the lowest 10%
    this.episodic.sort((a, b) => this.getMemoryRecallWeight(b) - this.getMemoryRecallWeight(a));
    const excessCount = this.episodic.length - this.maxEpisodicSize;
    if (excessCount > 0) {
      console.log(`Memory pruning triggered. Archiving ${excessCount} lowest relevance episodic memories.`);
      this.episodic.splice(this.maxEpisodicSize);
    }
  }

  /**
   * Compresses matching conversational facts. 
   * Merges multiple episodic triggers into standard semantic formulas.
   */
  public compressSemanticMemories(activeNodes: Node[]) {
    // Looks at episodic memories, isolates clusters of concepts, and promotes repeated concepts
    const frequency: Record<string, number> = {};
    for (const mem of this.episodic) {
      for (const concept of mem.concepts) {
        frequency[concept] = (frequency[concept] || 0) + 1;
      }
    }

    for (const [concept, count] of Object.entries(frequency)) {
      if (count >= 4) {
        const associatedNode = activeNodes.find(n => n.id === concept);
        if (associatedNode && !this.semantic.some(s => s.concepts.includes(concept))) {
          this.addSemantic(
            `Concept '${associatedNode.label}' is a frequent cognitive vector in the user experience.`,
            [concept],
            0.9,
            0.8
          );
        }
      }
    }
  }
}
