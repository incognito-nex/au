/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReasoningTrace, ReasoningStep, Node, Edge, Fact, SystemMetrics } from "./types.js";
import { KnowledgeGraph } from "./knowledge.js";
import { CognitiveMemory } from "./memory.js";
import { LearningSystem } from "./learning.js";
import { normalizeUserInput } from "./normalization.js";
import { calculateSentelumScore } from "./sentelum.js";
import { queryTeacher } from "./provider.js";

export class CognitiveOrchestrator {
  constructor() {}

  /**
   * Executes the full multi-layer cognitive reasoning pipeline.
   */
  public async executePipeline(
    userInput: string,
    graph: KnowledgeGraph,
    memory: CognitiveMemory,
    learning: LearningSystem,
    metrics: SystemMetrics
  ): Promise<ReasoningTrace> {
    const steps: ReasoningStep[] = [];
    const beginTime = Date.now();

    // STEP 1: INPUT LAYER NORMALIZATION
    steps.push({
      name: "Input Understanding",
      description: "Normalizing text spelling, intents, topics and extracting raw high-dimensional vectors.",
      details: { timestamp: Date.now() - beginTime }
    });
    
    const normalizedInput = await normalizeUserInput(userInput);
    // Update active index
    steps[0].details = {
      normalized: {
        intent: normalizedInput.intent,
        concept: normalizedInput.primaryConcept,
        synonyms: normalizedInput.synonyms,
        topic: normalizedInput.topic,
        entities: normalizedInput.entities,
        emotions: normalizedInput.emotions,
        vector: normalizedInput.estimatedVector
      }
    };

    // Adding context tags into Short Term Memory
    memory.addShortTerm(
      `User input text: "${userInput}" with intent "${normalizedInput.intent}"`,
      [normalizedInput.primaryConcept, ...normalizedInput.entities]
    );

    // STEP 2: SEMANTIC SEARCH (Sentelum Score Calculations)
    steps.push({
      name: "Custom Semantic Engine",
      description: "Applying 16-D Sentelum Vector similarities combined with Graph relationships, context, and recency.",
      details: {}
    });

    const scoredNodes: Array<{ node: Node; scores: any }> = [];
    const allGraphEdges = graph.edges;

    // Compile query tags (entities, topic, emotions, contextTags)
    const queryTags = [
      normalizedInput.primaryConcept,
      normalizedInput.topic,
      ...normalizedInput.synonyms,
      ...normalizedInput.entities,
      ...normalizedInput.contextTags
    ].filter(Boolean);

    for (const node of graph.nodes.values()) {
      const scores = calculateSentelumScore({
        queryVector: normalizedInput.estimatedVector,
        queryTags: queryTags,
        node: node,
        graphEdges: allGraphEdges,
        primaryQueryConcept: normalizedInput.primaryConcept
      });
      scoredNodes.push({ node, scores });
    }

    // Sort nodes by Sentelum similarity
    scoredNodes.sort((a, b) => b.scores.compositeScore - a.scores.compositeScore);
    const topScored = scoredNodes.slice(0, 5); // Take top 5 nodes

    steps[1].details = {
      scoredRankings: topScored.map(s => ({
        id: s.node.id,
        label: s.node.label,
        compositeScore: s.scores.compositeScore,
        breakdown: {
          semantic: s.scores.semanticPart,
          context: s.scores.contextPart,
          relationship: s.scores.relationshipPart,
          confidence: s.scores.confidencePart,
          recency: s.scores.recencyPart
        }
      }))
    };

    // STEP 3: KNOWLEDGE GRAPH RETRIEVAL
    steps.push({
      name: "Knowledge Graph Retrieval",
      description: "Locating matching facts, entities, and connecting margins in the Knowledge Graph.",
      details: {}
    });

    const retrievedNodes = topScored.filter(s => s.scores.compositeScore > 0.3).map(s => s.node);
    const retrievedNodeIds = retrievedNodes.map(n => n.id);

    // Filter relevant edges
    const retrievedEdges = graph.edges.filter(
      e => retrievedNodeIds.includes(e.source) || retrievedNodeIds.includes(e.target)
    );

    // Filter matching facts
    const retrievedFacts = learning.facts.filter(
      f => retrievedNodeIds.includes(f.subject) || retrievedNodeIds.includes(f.object)
    );

    steps[2].details = {
      retrievedConcepts: retrievedNodes.map(n => n.label),
      retrievedEdgesCount: retrievedEdges.length,
      retrievedFactsCount: retrievedFacts.length,
      matchingFacts: retrievedFacts.map(f => `${f.subject} ${f.predicate} ${f.object} (confidence: ${f.confidence})`)
    };

    // STEP 4: MEMORY LAYER COMPILATION (Short/Long term/Semantic compile)
    steps.push({
      name: "Cognitive Memory Compilation",
      description: "Retrieving relevant facts from Episodic and semantic layers, compiling context.",
      details: {}
    });

    // Check relevant episodic memories based on concept overlap
    const relevantEpisodic = memory.episodic.filter(m => 
      m.concepts.some(c => retrievedNodeIds.includes(c) || c === normalizedInput.primaryConcept)
    ).slice(0, 3);

    const relevantSemantic = memory.semantic.filter(s => 
      s.concepts.some(c => retrievedNodeIds.includes(c) || c === normalizedInput.primaryConcept)
    ).slice(0, 3);

    steps[3].details = {
      episodicCount: relevantEpisodic.length,
      semanticCount: relevantSemantic.length,
      ambientShortTerm: memory.shortTerm.slice(-3).map(m => m.content)
    };

    // STEP 5: COGNITIVE reasoning Matrix
    steps.push({
      name: "Reasoning Matrix Formulation",
      description: "Weighing assertion confidence ratings, structuring grounding context to avoid hallucination.",
      details: {}
    });

    // Compute average confidence of retrieved facts
    let compositeConfidence = 0.85; // baseline
    if (retrievedFacts.length > 0) {
      const sumConfidence = retrievedFacts.reduce((sum, f) => sum + f.confidence, 0);
      compositeConfidence = sumConfidence / retrievedFacts.length;
    }

    steps[4].details = {
      calculatedResponseConfidence: Number(compositeConfidence.toFixed(3)),
      hallucinationMitigationThreshold: "Active (Retrieved facts strictly anchor output generator)"
    };

    // STEP 6: TEACHER-BASED REASONED ANSWER GENERATION
    steps.push({
      name: "Response Synthesis",
      description: "Combining localized cognitive knowledge with the linguistic model reasoning engine.",
      details: {}
    });

    // We build a rich grounding prompt of local facts and concepts so the teacher acts strictly within our brains
    const groundingContext = retrievedFacts.map(f => 
      `- Local Fact: ${f.subject} ${f.predicate} ${f.object} (Confidence: ${f.confidence}, verified from source: "${f.rawSource}")`
    ).join("\n");

    const episodicContext = relevantEpisodic.map(m => 
      `- Past Interaction: "${m.content}"`
    ).join("\n");

    const semanticContext = relevantSemantic.map(s => 
      `- Global Belief: ${s.content}`
    ).join("\n");

    const systemPromptMessage = `You are the linguistic mouth of the STARLIGHT AI Engine.
You do NOT invent knowledge of your own. You must reason strictly based on the retrieved facts, memories, and concepts provided below.

==================================
LOCAL GROUNDING CORE (THE CELLULAR BRAIN)
==================================
Topic detected: ${normalizedInput.topic}
Primary Concept: ${normalizedInput.primaryConcept} (Synonyms: ${normalizedInput.synonyms.join(", ")})

Retrieved Verified Facts:
${groundingContext || "No highly specific facts found for this topic."}

Semantic Memory beliefs:
${semanticContext || "No deep semantic beliefs triggered."}

Past Episodic Experiences:
${episodicContext || "No matching past experiences."}

==================================
INSTRUCTIONS
==================================
1. Synthesize a elegant response explaining or answering the user's input.
2. Rely strictly on the verified facts above. If you mention facts outside the provided scope, explicitly state "Starlight hypothesis: [Fact] (Hypothetical, confidence: 0.25)".
3. Cite sources dynamically. E.g. "...as Guido van Rossum created Python [confidence: 0.95]".
4. Keep the response elegant, crisp, scientific, and direct.`;

    const generatedResponse = await queryTeacher(
      userInput,
      systemPromptMessage
    );

    steps[5].details = {
      generatedTextSize: generatedResponse.length,
      referencedFactsRatio: retrievedFacts.length > 0 ? "High" : "Exploratory"
    };

    // STEP 7: SELF-IMPROVEMENT & DYNAMIC LEARNING PIPELINE
    steps.push({
      name: "Autonomous Self-Learning",
      description: "Analyzing discussions in real-time, extracting newly learned facts, adjusting confidence levels.",
      details: {}
    });

    const learnedFacts = await learning.learnFromTurn(userInput, generatedResponse, graph);
    memory.addShortTerm(`System generated answer: "${generatedResponse.slice(0, 100)}..."`, [normalizedInput.primaryConcept]);
    
    // Run Advanced Heuristics to supercharge knowledge!
    const heuristicsReport = learning.runAdvancedLearningHeuristics(graph);
    
    // Compile semantic compression
    memory.compressSemanticMemories(Array.from(graph.nodes.values()));

    // Update metrics
    metrics.totalInteractions += 1;
    metrics.learnedFacts += learnedFacts.length +
      heuristicsReport.deductiveLearned + heuristicsReport.inductiveLearned +
      heuristicsReport.analogiesMapped;

    if (learnedFacts.length > 0) {
      metrics.retrievalSuccessCount += 1;
      // Recalculate average confidence of facts
      const activeFacts = learning.facts;
      if (activeFacts.length > 0) {
        metrics.averageConfidence = activeFacts.reduce((sum, f) => sum + f.confidence, 0) / activeFacts.length;
      }
    }

    steps[6].details = {
      extractedFactsCount: learnedFacts.length,
      heuristicsExtrapolated: heuristicsReport.deductiveLearned + heuristicsReport.inductiveLearned,
      newFacts: learnedFacts.map(f => `${f.subject} ${f.predicate} ${f.object}`),
      metricsUpdated: {
        totalInteractions: metrics.totalInteractions,
        totalLearnedFacts: metrics.learnedFacts,
        averageConfidence: Number(metrics.averageConfidence.toFixed(3))
      }
    };

    // Record response timestamp accesses in nodes
    for (const node of retrievedNodes) {
      node.usageFrequency += 1;
      node.lastAccessed = Date.now();
    }

    return {
      input: userInput,
      normalized: normalizedInput,
      steps,
      retrievedNodes,
      retrievedEdges,
      retrievedFacts,
      confidence: Number(compositeConfidence.toFixed(3)),
      response: generatedResponse
    };
  }
}
