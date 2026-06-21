/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Node, Edge, EdgeType, VectorArray } from "./types.js";
import { cosineSimilarity } from "./sentelum.js";

export class KnowledgeGraph {
  public nodes: Map<string, Node> = new Map();
  public edges: Edge[] = [];

  constructor() {
    this.initializeCoreNodes();
  }

  /**
   * Bootstraps the cognitive system with rich default knowledge.
   */
  private initializeCoreNodes() {
    // 16-D order: [PHYSICAL, DIGITAL, ABSTRACT, BIOLOGICAL, MECHANICAL, TRANSPORT, COGNITIVE, CREATIVE, TEMPORAL, SOCIAL, SCIENTIFIC, LANGUAGE, CREATOR, TOOL, PROCESS, QUANTITATIVE]
    const coreElements: Array<{ id: string; label: string; vector: VectorArray; topic: string; synonyms: string[] }> = [
      {
        id: "automobile",
        label: "Automobile",
        vector: [0.9, 0.0, 0.1, 0.0, 0.95, 0.95, 0.0, 0.1, 0.0, 0.2, 0.4, 0.0, 0.0, 0.5, 0.1, 0.6],
        topic: "transportation",
        synonyms: ["car", "vehicle", "ride", "passenger car"]
      },
      {
        id: "vehicle",
        label: "Vehicle",
        vector: [0.9, 0.0, 0.2, 0.0, 0.8, 0.9, 0.0, 0.0, 0.0, 0.3, 0.3, 0.0, 0.0, 0.6, 0.1, 0.7],
        topic: "transportation",
        synonyms: ["transport", "automobile", "transit car"]
      },
      {
        id: "python",
        label: "Python",
        vector: [0.0, 0.95, 0.85, 0.0, 0.0, 0.0, 0.8, 0.1, 0.1, 0.2, 0.6, 0.95, 0.0, 0.9, 0.6, 0.1],
        topic: "programming",
        synonyms: ["python script", "python language"]
      },
      {
        id: "guido",
        label: "Guido van Rossum",
        vector: [0.8, 0.1, 0.4, 0.8, 0.0, 0.0, 0.9, 0.3, 0.5, 0.7, 0.2, 0.6, 0.95, 0.2, 0.3, 0.1],
        topic: "programming",
        synonyms: ["gvr", "creator of python"]
      },
      {
        id: "programming language",
        label: "Programming Language",
        vector: [0.0, 0.95, 0.9, 0.0, 0.0, 0.0, 0.85, 0.2, 0.1, 0.4, 0.6, 0.95, 0.1, 0.9, 0.7, 0.2],
        topic: "programming",
        synonyms: ["code syntax", "programming dialect"]
      },
      {
        id: "logic",
        label: "Logic",
        vector: [0.0, 0.3, 0.95, 0.0, 0.0, 0.0, 0.95, 0.1, 0.1, 0.3, 0.8, 0.4, 0.0, 0.7, 0.8, 0.4],
        topic: "philosophy",
        synonyms: ["reasoning", "rationality", "boolean deduction"]
      }
    ];

    for (const item of coreElements) {
      this.addOrUpdateNode(item.id, item.label, item.vector, {
        topic: item.topic,
        synonyms: item.synonyms,
        tags: [item.topic],
        confidence: 0.95
      });
    }

    // Connect them
    this.addEdge("automobile", "vehicle", "is_a", 0.95, 0.95);
    this.addEdge("python", "programming language", "is_a", 0.95, 0.95);
    this.addEdge("programming language", "logic", "requires", 0.9, 0.9);
    this.addEdge("python", "guido", "created_by", 1.0, 0.95);
  }

  /**
   * Adds or updates a node in the graph.
   */
  public addOrUpdateNode(
    id: string,
    label: string,
    vector: VectorArray,
    metadata: Record<string, any> = {}
  ): Node {
    const key = id.toLowerCase().trim();
    const existing = this.nodes.get(key);

    if (existing) {
      existing.usageFrequency += 1;
      existing.lastAccessed = Date.now();
      existing.label = label || existing.label;
      existing.vector = vector || existing.vector;
      existing.metadata = { ...existing.metadata, ...metadata };
      this.recalculateImportance(existing);
      return existing;
    }

    const node: Node = {
      id: key,
      label: label || id,
      vector,
      importance: 0.1,
      usageFrequency: 1,
      lastAccessed: Date.now(),
      metadata: {
        synonyms: [],
        tags: [],
        confidence: 0.7,
        ...metadata
      }
    };

    this.nodes.set(key, node);
    this.recalculateImportance(node);
    return node;
  }

  /**
   * Generates a link/edge connecting two concepts, updating weight/confidence if duplicated.
   */
  public addEdge(
    source: string,
    target: string,
    type: EdgeType,
    weight = 0.5,
    confidence = 0.5
  ): Edge {
    const srcKey = source.toLowerCase().trim();
    const tgtKey = target.toLowerCase().trim();

    // Ensure directionality/deduplication
    const existing = this.edges.find(
      e => e.source === srcKey && e.target === tgtKey && e.type === type
    );

    if (existing) {
      existing.weight = Math.min(1.0, (existing.weight * 2 + weight) / 3);
      existing.confidence = Math.min(1.0, (existing.confidence * 3 + confidence) / 4);
      return existing;
    }

    const edge: Edge = {
      source: srcKey,
      target: tgtKey,
      type,
      weight,
      confidence,
      created: Date.now()
    };

    this.edges.push(edge);

    // Recalculate target nodes importance
    const srcNode = this.nodes.get(srcKey);
    const tgtNode = this.nodes.get(tgtKey);
    if (srcNode) this.recalculateImportance(srcNode);
    if (tgtNode) this.recalculateImportance(tgtNode);

    return edge;
  }

  /**
   * Recalculates importance metric based on grade, degree, and usage frequency.
   */
  private recalculateImportance(node: Node) {
    const connections = this.edges.filter(e => e.source === node.id || e.target === node.id).length;
    // Normalized importance compounding degree and usage
    const rawImportance = (connections * 0.15) + (node.usageFrequency * 0.05);
    node.importance = Number(Math.max(0.1, Math.min(1, rawImportance)).toFixed(3));
  }

  /**
   * Performs dynamic synonym pointing and discovery.
   * If two concepts are highly similar (>0.87 cosine similarity) and not connected, recommend relationship.
   */
  public discoverRelationships(): Array<{ source: string; target: string; similarity: number }> {
    const arrayNodes = Array.from(this.nodes.values());
    const discovered: Array<{ source: string; target: string; similarity: number }> = [];

    for (let i = 0; i < arrayNodes.length; i++) {
      for (let j = i + 1; j < arrayNodes.length; j++) {
        const n1 = arrayNodes[i];
        const n2 = arrayNodes[j];
        if (n1.id === n2.id) continue;

        // Check if there is already an edge
        const connected = this.edges.some(
          e => (e.source === n1.id && e.target === n2.id) || (e.source === n2.id && e.target === n1.id)
        );

        if (!connected) {
          const sim = cosineSimilarity(n1.vector, n2.vector);
          if (sim > 0.85) {
            discovered.push({
              source: n1.id,
              target: n2.id,
              similarity: Number(sim.toFixed(4))
            });
          }
        }
      }
    }

    return discovered;
  }

  /**
   * Automatically clusters nodes by matching themes.
   */
  public getConceptClusters(): Record<string, string[]> {
    const clusters: Record<string, string[]> = {};
    for (const node of this.nodes.values()) {
      const topic = node.metadata.topic || "general";
      if (!clusters[topic]) {
        clusters[topic] = [];
      }
      clusters[topic].push(node.label);
    }
    return clusters;
  }

  /**
   * Resolves duplicates and synonym conflicts by merging redundant concepts.
   */
  public mergeConcepts(canonicalId: string, redundantId: string) {
    const canonical = this.nodes.get(canonicalId.toLowerCase());
    const redundant = this.nodes.get(redundantId.toLowerCase());
    if (!canonical || !redundant) return;

    // Merge metadata
    canonical.usageFrequency += redundant.usageFrequency;
    if (redundant.metadata.synonyms) {
      canonical.metadata.synonyms = Array.from(new Set([
        ...(canonical.metadata.synonyms || []),
        redundant.id,
        redundant.label,
        ...redundant.metadata.synonyms
      ]));
    }

    // Remap edges referencing redundant node
    for (const edge of this.edges) {
      if (edge.source === redundant.id) edge.source = canonical.id;
      if (edge.target === redundant.id) edge.target = canonical.id;
    }

    // Delete redundant node
    this.nodes.delete(redundant.id);
    this.recalculateImportance(canonical);
  }
}
