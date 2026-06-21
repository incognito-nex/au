/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VectorArray, Node, Edge } from "./types.js";

/**
 * Calculates the dot product of two vectors.
 */
export function dotProduct(v1: VectorArray, v2: VectorArray): number {
  let dot = 0;
  for (let i = 0; i < 16; i++) {
    dot += (v1[i] || 0) * (v2[i] || 0);
  }
  return dot;
}

/**
 * Calculates the magnitude of a vector.
 */
export function magnitude(v: VectorArray): number {
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    sum += (v[i] || 0) * (v[i] || 0);
  }
  return Math.sqrt(sum);
}

/**
 * Calculates cosine similarity between two 16-D vectors.
 * Returns a value between 0.0 and 1.0.
 */
export function cosineSimilarity(v1: VectorArray, v2: VectorArray): number {
  const mag1 = magnitude(v1);
  const mag2 = magnitude(v2);
  if (mag1 === 0 || mag2 === 0) return 0;
  const similarity = dotProduct(v1, v2) / (mag1 * mag2);
  return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
}

/**
 * Normalizes vector values to be between 0.0 and 1.0.
 */
export function normalizeVector(v: VectorArray): VectorArray {
  const norm = magnitude(v);
  if (norm === 0) return Array(16).fill(0) as VectorArray;
  return v.map(val => Number((val / norm).toFixed(4))) as VectorArray;
}

/**
 * Composes a new concept vector (vector addition + average).
 */
export function composeVectors(v1: VectorArray, v2: VectorArray, weight1 = 0.5, weight2 = 0.5): VectorArray {
  const result: number[] = [];
  for (let i = 0; i < 16; i++) {
    result.push((v1[i] || 0) * weight1 + (v2[i] || 0) * weight2);
  }
  return normalizeVector(result) as VectorArray;
}

/**
 * Calculates Jaccard similarity between two string arrays (for context/tag matching).
 */
export function jaccardSimilarity(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0;
  const set1 = new Set(arr1.map(s => s.toLowerCase().trim()));
  const set2 = new Set(arr2.map(s => s.toLowerCase().trim()));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Composite Sentelum Scoring Engine.
 * 
 * Formula:
 * Score = semantic_score * 0.45
 *       + context_score * 0.25
 *       + relationship_score * 0.15
 *       + confidence_score * 0.10
 *       + recency_score * 0.05
 */
export function calculateSentelumScore(params: {
  queryVector: VectorArray;
  queryTags: string[];
  node: Node;
  graphEdges: Edge[];
  primaryQueryConcept: string;
}): {
  compositeScore: number;
  semanticPart: number;
  contextPart: number;
  relationshipPart: number;
  confidencePart: number;
  recencyPart: number;
} {
  const { queryVector, queryTags, node, graphEdges, primaryQueryConcept } = params;

  // 1. Semantic Similarity (Cosine Similarity between vectors)
  const semanticScore = cosineSimilarity(queryVector, node.vector);

  // 2. Context Similarity (Jaccard similarity of tags/metadata)
  const nodeTags = [
    node.id, 
    node.label, 
    ...(node.metadata.tags || []),
    ...(node.metadata.synonyms || []), 
    node.metadata.topic || ""
  ].filter(Boolean);
  const contextScore = jaccardSimilarity(queryTags, nodeTags);

  // 3. Relationship Distance (Direct vs indirect Graph edges)
  let relationshipScore = 0;
  if (node.id === primaryQueryConcept) {
    relationshipScore = 1.0;
  } else {
    // Check if there is a direct edge between the concepts
    const directEdge = graphEdges.find(
      e => (e.source === primaryQueryConcept && e.target === node.id) ||
           (e.source === node.id && e.target === primaryQueryConcept)
    );
    if (directEdge) {
      relationshipScore = 0.8 * directEdge.weight;
    } else {
      // Check 2nd hop (indirect relationship)
      const isIndirect = graphEdges.some(e1 => {
        const intermediate = e1.source === primaryQueryConcept ? e1.target : (e1.target === primaryQueryConcept ? e1.source : null);
        if (!intermediate) return false;
        return graphEdges.some(e2 => 
          (e2.source === intermediate && e2.target === node.id) || 
          (e2.target === intermediate && e2.source === node.id)
        );
      });
      if (isIndirect) {
        relationshipScore = 0.4;
      }
    }
  }

  // 4. Confidence Scaling (Metadata confidence rating, defaulting to 0.7 if unconfigured)
  const confidenceScore = typeof node.metadata.confidence === "number" ? node.metadata.confidence : 0.7;

  // 5. Recency Decay (Based on timestamp of last access)
  const now = Date.now();
  const timeDifferenceInMs = now - node.lastAccessed;
  const timeInHours = timeDifferenceInMs / (1000 * 60 * 60);
  // Half-life of 24 hours for recency recall
  const recencyScore = Math.exp(-0.02 * timeInHours);

  // Compute terms weighted
  const semanticPart = semanticScore * 0.45;
  const contextPart = contextScore * 0.25;
  const relationshipPart = relationshipScore * 0.15;
  const confidencePart = confidenceScore * 0.10;
  const recencyPart = recencyScore * 0.05;

  const compositeScore = Math.max(0, Math.min(1, 
    semanticPart + contextPart + relationshipPart + confidencePart + recencyPart
  ));

  return {
    compositeScore: Number(compositeScore.toFixed(4)),
    semanticPart: Number(semanticPart.toFixed(4)),
    contextPart: Number(contextPart.toFixed(4)),
    relationshipPart: Number(relationshipPart.toFixed(4)),
    confidencePart: Number(confidencePart.toFixed(4)),
    recencyPart: Number(recencyPart.toFixed(4))
  };
}

/**
 * projects high-dimensional vectors to simple 2D coordinates for interactive coordinate graphs.
 * Simple projection based on transportation component (X) and cognitive/digital component (Y).
 */
export function projectVectorTo2D(vector: VectorArray): { x: number; y: number } {
  // Mechanical/Hardware/Transport vs Abstract/Digital/Cognitive
  // We want to project to range [-100, 100]
  const transportSum = (vector[0] || 0) * 0.3 + (vector[4] || 0) * 0.5 + (vector[5] || 0) * 0.8;
  const cognitiveSum = (vector[1] || 0) * 0.5 + (vector[2] || 0) * 0.7 + (vector[6] || 0) * 0.8;
  const biologicalSum = (vector[3] || 0) * 1.0;
  const socialCreativeSum = (vector[7] || 0) * 0.5 + (vector[9] || 0) * 0.7;

  const x = (transportSum - biologicalSum - abstractReduction(vector)) * 140;
  const y = (cognitiveSum + socialCreativeSum - (vector[0] || 0)*0.4) * 140;

  return { 
    x: Math.round(Math.max(-180, Math.min(180, x))), 
    y: Math.round(Math.max(-180, Math.min(180, y))) 
  };
}

function abstractReduction(v: VectorArray): number {
  return (v[2] || 0) * 0.3 + (v[11] || 0) * 0.2;
}
