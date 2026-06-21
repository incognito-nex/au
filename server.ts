/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Imports for Starlight Cognitive Engine
import { KnowledgeGraph } from "./src/engine/knowledge.ts";
import { CognitiveMemory } from "./src/engine/memory.ts";
import { LearningSystem } from "./src/engine/learning.ts";
import { EngineStorage } from "./src/engine/storage.ts";
import { CognitiveOrchestrator } from "./src/engine/reasoning.ts";
import { SystemMetrics, Fact } from "./src/engine/types.ts";
import { projectVectorTo2D } from "./src/engine/sentelum.ts";
import { normalizeUserInput } from "./src/engine/normalization.ts";
import { PROVIDERS_REGISTRY, PROMPT_EXECUTION_MODE, setPromptExecutionMode, testProviderConnectivity, getActiveKey, callIndividualProviderDirect, rotateKey } from "./src/engine/provider.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure JSON body parsers
  app.use(express.json());

  // Instantiate Cognitive Engine Stack
  let graph = new KnowledgeGraph();
  let memory = new CognitiveMemory();
  let learning = new LearningSystem();
  let storage = new EngineStorage();
  let orchestrator = new CognitiveOrchestrator();

  let metrics: SystemMetrics = {
    totalInteractions: 0,
    learnedFacts: 4, // Starts with bootstrapped count
    averageConfidence: 0.95,
    correctionsCount: 0,
    mistakesResolved: 0,
    retrievalSuccessCount: 0
  };

  // Restore State from Storage file if present
  const savedState = storage.loadState();
  if (savedState) {
    console.log("Restoring cognitive states from persistent store...");
    try {
      // Re-populate graph map
      graph.nodes.clear();
      for (const node of savedState.nodes) {
        graph.nodes.set(node.id, node);
      }
      graph.edges = savedState.edges || [];
      
      // Re-populate learning facts
      learning.facts = savedState.facts || [];
      learning.conflicts = savedState.conflicts || [];
      
      // Re-populate memories
      memory.shortTerm = savedState.shortTerm || [];
      memory.episodic = savedState.episodic || [];
      memory.semantic = savedState.semantic || [];
      
      // Re-populate metrics
      metrics = savedState.metrics || metrics;
      console.log(`State loaded successfully: ${graph.nodes.size} Nodes, ${learning.facts.length} Facts, ${memory.episodic.length} Experiences.`);
    } catch (err) {
      console.error("Failed to parse restored state parameters:", err);
    }
  } else {
    // Inject bootstrapped facts to keep graph and learning engine in-sync initially
    learning.facts = [
      {
        id: "fa_boot_1",
        subject: "automobile",
        predicate: "is_a",
        object: "vehicle",
        rawSource: "Automobile is a level of passenger transport vehicle",
        confidence: 0.95,
        sourceCount: 1,
        lastVerified: Date.now(),
        context: "transportation"
      },
      {
        id: "fa_boot_2",
        subject: "python",
        predicate: "is_a",
        object: "programming language",
        rawSource: "Python is a modern high-level script language",
        confidence: 0.95,
        sourceCount: 1,
        lastVerified: Date.now(),
        context: "programming"
      },
      {
        id: "fa_boot_3",
        subject: "programming language",
        predicate: "requires",
        object: "logic",
        rawSource: "All general programming languages require boolean logic structures",
        confidence: 0.9,
        sourceCount: 1,
        lastVerified: Date.now(),
        context: "programming"
      },
      {
        id: "fa_boot_4",
        subject: "python",
        predicate: "created_by",
        object: "guido",
        rawSource: "Python was created by Guido van Rossum in 1991",
        confidence: 1.0,
        sourceCount: 1,
        lastVerified: Date.now(),
        context: "programming"
      }
    ];
  }

  // Background Training States
  let activeTrainingTopic: string | null = null;
  let isTrainingActive = false;
  let lastTrainingResult: any = null;

  // Define Helper to write changes to local state
  const persistChanges = () => {
    storage.saveState({ graph, memory, learning, metrics });
  };

  // API: Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "online", 
      time: new Date().toISOString(),
      offlineMode: PROVIDERS_REGISTRY.filter(p => p.enabled && p.keys.length > 0).length === 0
    });
  });

  // API: Get Multi-provider configuration state
  app.get("/api/engine/providers", (req, res) => {
    res.json({
      providers: PROVIDERS_REGISTRY,
      mode: PROMPT_EXECUTION_MODE
    });
  });

  // API: Update dynamic multi-provider settings
  app.post("/api/engine/providers/config", (req, res) => {
    const { id, enabled, selectedModel, keys } = req.body;
    const provider = PROVIDERS_REGISTRY.find(p => p.id === id);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    if (enabled !== undefined) provider.enabled = !!enabled;
    if (selectedModel !== undefined) provider.selectedModel = selectedModel;
    if (keys !== undefined && Array.isArray(keys)) {
      provider.keys = keys.filter(k => k && k.trim().length > 0);
      provider.keyIndex = 0; // reset pointer
    }

    res.json({ success: true, provider });
  });

  // API: Change prompt execution orchestration mode (waterfall / multithread)
  app.post("/api/engine/providers/mode", (req, res) => {
    const { mode } = req.body;
    if (mode === "waterfall" || mode === "multithread") {
      setPromptExecutionMode(mode);
      res.json({ success: true, mode: PROMPT_EXECUTION_MODE });
    } else {
      res.status(400).json({ error: "Invalid execution mode. Specify waterfall or multithread." });
    }
  });

  // API: Test provider connectivity
  app.post("/api/engine/providers/test", async (req, res) => {
    const { id, keys } = req.body;
    try {
      const result = await testProviderConnectivity(id, keys);
      res.json(result);
    } catch (err: any) {
      res.json({ success: false, latencyMs: 0, error: err.message || "Failed request" });
    }
  });

  // API: Get Cognitive representation data
  app.get("/api/engine/state", (req, res) => {
    // Return all structured memories, facts, and coordinate projections of Nodes for visual mapping
    const projectedNodes = Array.from(graph.nodes.values()).map(node => {
      const coord2D = projectVectorTo2D(node.vector);
      return {
        ...node,
        x: coord2D.x,
        y: coord2D.y
      };
    });

    res.json({
      nodes: projectedNodes,
      edges: graph.edges,
      facts: learning.facts,
      shortTerm: memory.shortTerm,
      episodic: memory.episodic,
      semantic: memory.semantic,
      conflicts: learning.conflicts,
      metrics,
      isTrainingActive,
      activeTrainingTopic,
      lastTrainingResult
    });
  });

  // API: Execute Pipeline Chat route
  app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing required parameter: message" });
    }

    try {
      const trace = await orchestrator.executePipeline(
        message,
        graph,
        memory,
        learning,
        metrics
      );

      // Save states
      persistChanges();

      res.json({ success: true, trace });
    } catch (err: any) {
      console.error("Pipeline breakdown:", err);
      res.status(500).json({ error: err.message || "Failed to process message in pipeline." });
    }
  });

  // API: Concurrent Multi-Threaded Auto-Training of the Graph by all enabled AIs
  app.post("/api/engine/autotrain", async (req, res) => {
    if (isTrainingActive) {
      return res.status(400).json({ error: "A cognitive co-training session is already active in the background." });
    }

    let { topic } = req.body;
    
    // Choose dynamic topic if not specified
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      const existingNodes = Array.from(graph.nodes.values());
      if (existingNodes.length > 0) {
        const randomNode = existingNodes[Math.floor(Math.random() * existingNodes.length)];
        topic = randomNode.label;
      } else {
        const topics = ["deep learning neural networks", "quantum entanglements", "space exploration", "autonomous AI agents", "cellular automation", "metrology standards"];
        topic = topics[Math.floor(Math.random() * topics.length)];
      }
    }

    const cleanTopic = topic.trim().toLowerCase();
    const activeProviders = PROVIDERS_REGISTRY.filter(p => p.enabled && p.keys.length > 0);

    // Set background flags
    isTrainingActive = true;
    activeTrainingTopic = cleanTopic;
    lastTrainingResult = null;

    // Immediately respond to client
    res.json({
      success: true,
      message: "Starlight Auto-Training initiated in background.",
      topic: cleanTopic,
      onlineChannels: activeProviders.map(p => p.name)
    });

    // Execute heavy training pipeline in the background asynchronously
    (async () => {
      console.log(`[BACKGROUND TRAINER] Starting auto-train sweep for topic: "${cleanTopic}"`);
      const results: any[] = [];
      const factsLearned: any[] = [];

      const FREE_KNOWLEDGE_DATABASES = [
        { subject: "transformer", predicate: "requires", object: "attention-mechanism", rawSource: "The transformer model utilizes an attention-mechanism to weigh token relationships.", confidence: 0.98, context: "artificial-intelligence" },
        { subject: "transformer", predicate: "is_a", object: "neural-network", rawSource: "The Transformer is a deep neural-network architecture designed for seq2seq tasks.", confidence: 0.99, context: "artificial-intelligence" },
        { subject: "attention-mechanism", predicate: "similar_to", object: "cognitive-focus", rawSource: "Mathematical attention mechanisms are styled similar to human cognitive focus concepts.", confidence: 0.91, context: "artificial-intelligence" },
        { subject: "neural-network", predicate: "related_to", object: "machine-learning", rawSource: "Deep neural networks are standard architectures within subclass of machine-learning models.", confidence: 0.99, context: "artificial-intelligence" },
        { subject: "deep-learning", predicate: "is_a", object: "machine-learning", rawSource: "Deep-learning refers to neural network layers operating within machine-learning frameworks.", confidence: 0.99, context: "artificial-intelligence" },
        { subject: "backpropagation", predicate: "causes", object: "gradient-descent", rawSource: "Backpropagation processes calculate partial derivatives to drive gradient-descent weight shifts.", confidence: 0.97, context: "artificial-intelligence" },
        { subject: "convolutional-network", predicate: "part_of", object: "computer-vision", rawSource: "Convolutional neural network topologies represent critical part of computer-vision approaches.", confidence: 0.96, context: "artificial-intelligence" },
        { subject: "quantum-computing", predicate: "requires", object: "superposition", rawSource: "Quantum computing mechanisms require superposition to evaluate multiple state vectors simultaneously.", confidence: 0.98, context: "quantum-physics" },
        { subject: "qubit", predicate: "instance_of", object: "quantum-state", rawSource: "A physical qubit serves as a fundamental instance of a controlled quantum state.", confidence: 0.95, context: "quantum-physics" },
        { subject: "superposition", predicate: "related_to", object: "coherence", rawSource: "Maintaining superposition is physically related to quantum coherence tolerances.", confidence: 0.94, context: "quantum-physics" },
        { subject: "entanglement", predicate: "causes", object: "non-locality", rawSource: "Spooky action at a distance or entanglement causes non-locality observations in particle physics.", confidence: 0.97, context: "quantum-physics" },
        { subject: "quantum-computer", predicate: "similar_to", object: "analog-simulator", rawSource: "A quantum-computer solves specialized Hamiltonian constraints in a way similar to analog simulators.", confidence: 0.92, context: "quantum-physics" },
        { subject: "starship", predicate: "created_by", object: "spacex", rawSource: "The heavy Starship vessel was created by aerospace company SpaceX.", confidence: 0.99, context: "aerospace" },
        { subject: "rocket-engine", predicate: "requires", object: "liquid-oxygen", rawSource: "High-thrust rocket engines require cryogenic liquid-oxygen oxidizing Agents.", confidence: 0.98, context: "aerospace" },
        { subject: "liquid-oxygen", predicate: "related_to", object: "propellant", rawSource: "Methalox systems rely on liquid oxygen combined as chemical rocket propellant.", confidence: 0.97, context: "aerospace" },
        { subject: "mars-mission", predicate: "requires", object: "starship", rawSource: "Human exploration mars missions require massive re-usable lifters like Starship.", confidence: 0.94, context: "aerospace" },
        { subject: "rsa-encryption", predicate: "requires", object: "prime-factorization", rawSource: "RSA decryption security relies on difficulty of prime-factorization equations.", confidence: 0.99, context: "cryptography" },
        { subject: "cryptography", predicate: "part_of", object: "computer-science", rawSource: "Information theory and cryptography are considered central parts of computer-science.", confidence: 0.99, context: "cryptography" },
        { subject: "blockchain", predicate: "requires", object: "cryptography", rawSource: "Decentralized ledgers and blockchains fundamentally require cryptographic hash structures.", confidence: 0.98, context: "cryptography" },
        // Enhanced free offline database categories
        { subject: "reinforcement-learning", predicate: "requires", object: "reward-function", rawSource: "Reinforcement learning requires a reward function to guide agent policy updates.", confidence: 0.98, context: "artificial-intelligence" },
        { subject: "reward-function", predicate: "similar_to", object: "biological-dopamine", rawSource: "Mathematical reward functions act similar to biological dopamine paths in neurological brains.", confidence: 0.92, context: "neuroscience" },
        { subject: "policy-gradient", predicate: "is_a", object: "reinforcement-learning", rawSource: "Policy gradient is a mathematical subset of reinforcement learning policies.", confidence: 0.97, context: "artificial-intelligence" },
        { subject: "synapse", predicate: "requires", object: "neurotransmitter", rawSource: "Chemical synapses require neurotransmitter releases to cross the synaptic cleft.", confidence: 0.99, context: "neuroscience" },
        { subject: "dendrite", predicate: "part_of", object: "neuron", rawSource: "Dendrites are branching cellular components that form a critical sensory part of a biological neuron.", confidence: 0.99, context: "neuroscience" },
        { subject: "biological-dopamine", predicate: "causes", object: "synaptic-plasticity", rawSource: "Dopamine surges cause long-term synaptic plasticity and motivation reinforcement.", confidence: 0.96, context: "neuroscience" },
        { subject: "agentic-workflow", predicate: "requires", object: "tool-use", rawSource: "Autonomous agentic workflows require structured tool-use to interact with the environment.", confidence: 0.97, context: "cognitive-science" },
        { subject: "agentic-workflow", predicate: "similar_to", object: "human-planning", rawSource: "Multi-agent chains and reflection loops operate in ways similar to human peer-review planning.", confidence: 0.89, context: "cognitive-science" },
        { subject: "thermodynamics", predicate: "requires", object: "entropy", rawSource: "The second law of thermodynamics requires that total entropy of an isolated system always increases.", confidence: 1.00, context: "physics" },
        { subject: "entropy", predicate: "related_to", object: "information-theory", rawSource: "Thermodynamic entropy is mathematically isomorphic to Shannon entropy in information theory.", confidence: 0.99, context: "physics" },
        { subject: "superconductor", predicate: "requires", object: "cooper-pairs", rawSource: "Low-temperature BCS superconductivity requires the pairing of electrons into Cooper pairs.", confidence: 0.98, context: "physics" },
        { subject: "cooper-pairs", predicate: "causes", object: "zero-resistance", rawSource: "The coherent flow of Cooper pairs causes zero electrical resistance below critical temperature.", confidence: 0.98, context: "physics" }
      ];

      try {
        if (activeProviders.length === 0) {
          console.log(`[Starlight Background] No keys online. Performing offline knowledge fallback for topic: "${cleanTopic}"`);
          
          // Pattern matching on the rich local knowledge database
          let matchedFacts = FREE_KNOWLEDGE_DATABASES.filter(
            f => f.subject.includes(cleanTopic) || f.object.includes(cleanTopic) || f.context.includes(cleanTopic)
          );

          if (matchedFacts.length === 0) {
            // Default select 3 related or random ones to expand knowledge aggressively
            const countToGet = 3;
            for (let i = 0; i < countToGet; i++) {
              matchedFacts.push(FREE_KNOWLEDGE_DATABASES[Math.floor(Math.random() * FREE_KNOWLEDGE_DATABASES.length)]);
            }
          }

          results.push({
            providerId: "free_db_offline",
            providerName: "Free Public Knowledge Archive (No-Key Fallback)",
            success: true,
            latency: 150,
            extractedCount: matchedFacts.length
          });

          for (const matched of matchedFacts) {
            const fact: Fact = {
              id: "fa_free_" + Math.random().toString(36).substring(2, 11),
              subject: matched.subject,
              predicate: matched.predicate,
              object: matched.object,
              rawSource: matched.rawSource,
              confidence: matched.confidence,
              sourceCount: 1,
              lastVerified: Date.now(),
              context: matched.context
            };

            // @ts-ignore
            const integrated = await learning.integrateFact(fact, graph);
            if (integrated) {
              factsLearned.push({
                provider: "Free Knowledge Archive",
                fact: `${fact.subject} ${fact.predicate} ${fact.object}`,
                context: fact.context,
                confidence: fact.confidence,
                source: fact.rawSource
              });
            }
          }
        } else {
          // Trigger actual parallel LLM extraction queries!
          const trainPrompt = `Research and generate exactly 2 highly accurate, distinct conceptual facts about the topic: "${cleanTopic}".
Focus on objective, robust scientific, technical, biographical, or historical facts. Do NOT output vague opinions, greetings, suggestions, or chat prose.

For each fact, you MUST specify:
1. "subject": lowercase, short conceptual concept node (e.g., "transformer", "neural-network").
2. "predicate": precisely one of physical/logical relations: "is_a", "related_to", "causes", "requires", "similar_to", "opposite_of", "created_by", "instance_of", "part_of".
3. "object": lowercase, short target concept node (e.g., "attention-mechanism", "machine-learning").
4. "rawSource": precise, complete, single declarative sentence stating this exact relationship in full (e.g., "The transformer model utilizes an attention-mechanism to weigh token relationships.").
5. "confidence": floating numeric certainty rating between 0.90 and 1.00.
6. "context": short lowercase category descriptor (e.g., "artificial-intelligence", "physics", "computing").

You MUST return a strict JSON block exactly matching this schema, with no preamble, markdown wrapping, or extra text:
{
  "facts": [
    {
      "subject": "concept-a",
      "predicate": "relation",
      "object": "concept-b",
      "rawSource": "S...",
      "confidence": 0.95,
      "context": "domain"
    }
  ]
}`;

          const systemInstruction = "You are a specialized Multithreaded Brain Auto-Teacher. Respond ONLY in structured raw JSON facts arrays.";
          const promises = activeProviders.map(async (prov) => {
            const key = getActiveKey(prov.id);
            if (!key) {
              throw new Error("No active key configured");
            }

            const startTime = Date.now();
            try {
              const rawRes = await callIndividualProviderDirect(
                prov.id,
                key,
                prov.selectedModel,
                trainPrompt,
                systemInstruction,
                9000 // 9 second timeout per concurrent thread
              );

              const latency = Date.now() - startTime;
              let cleanedJson = rawRes.trim();

              if (cleanedJson.startsWith("```json")) {
                cleanedJson = cleanedJson.replace(/^```json/, "").replace(/```$/, "").trim();
              } else if (cleanedJson.startsWith("```")) {
                cleanedJson = cleanedJson.replace(/^```/, "").replace(/```$/, "").trim();
              }

              const parsed = JSON.parse(cleanedJson);
              const incomingFacts = parsed.facts || [];

              return {
                id: prov.id,
                name: prov.name,
                success: true,
                latency,
                facts: incomingFacts
              };
            } catch (err: any) {
              console.warn(`[BACKGROUND TRAINER] Provider "${prov.id}" failed in background. Retrying or cycling to handle. Error: ${err.message}`);
              // Cycle model or key for robust recovery
              try {
                prov.selectedModel = prov.models[(prov.models.indexOf(prov.selectedModel) + 1) % prov.models.length];
                rotateKey(prov.id);
              } catch (_) {}
              
              return {
                id: prov.id,
                name: prov.name,
                success: false,
                latency: Date.now() - startTime,
                error: err.message || "Failed API call"
              };
            }
          });

          const settled = await Promise.allSettled(promises);

          for (const item of settled) {
            if (item.status === "fulfilled") {
              const val = item.value;
              results.push({
                providerId: val.id,
                providerName: val.name,
                success: val.success,
                latency: val.latency,
                error: val.error,
                extractedCount: val.facts ? val.facts.length : 0
              });

              if (val.success && Array.isArray(val.facts)) {
                for (const rawFact of val.facts) {
                  if (!rawFact.subject || !rawFact.predicate || !rawFact.object) continue;

                  const fact: Fact = {
                    id: "fa_" + Math.random().toString(36).substring(2, 11),
                    subject: rawFact.subject.toLowerCase().trim(),
                    predicate: rawFact.predicate.toLowerCase().trim(),
                    object: rawFact.object.toLowerCase().trim(),
                    rawSource: rawFact.rawSource || `Extracted by ${val.name}`,
                    confidence: parseFloat(rawFact.confidence) || 0.92,
                    sourceCount: 1,
                    lastVerified: Date.now(),
                    context: rawFact.context || "synchronized-learning"
                  };

                  try {
                    // @ts-ignore
                    const integrated = await learning.integrateFact(fact, graph);
                    if (integrated) {
                      factsLearned.push({
                        provider: val.name,
                        fact: `${fact.subject} ${fact.predicate} ${fact.object}`,
                        context: fact.context,
                        confidence: fact.confidence,
                        source: fact.rawSource
                      });
                    }
                  } catch (e) {}
                }
              }
            }
          }
        }

        // Run complementary heuristic derivations!
        console.log(`[BACKGROUND TRAINER] Running deductive and inductive heuristics on fully processed graph.`);
        const heuristicsReport = learning.runAdvancedLearningHeuristics(graph);
        
        // Persist fully trained state changes
        persistChanges();

        // Update metrics indicators
        metrics.learnedFacts = learning.facts.length;
        metrics.averageConfidence = learning.facts.length > 0
          ? learning.facts.reduce((sum, f) => sum + f.confidence, 0) / learning.facts.length
          : 0.95;

        // Save progress indicators
        lastTrainingResult = {
          success: true,
          topic: cleanTopic,
          completedAt: Date.now(),
          activeChannelsCount: activeProviders.length === 0 ? 1 : activeProviders.length,
          results,
          factsLearned,
          heuristicsReport
        };
      } catch (trainErr: any) {
        console.error("[BACKGROUND TRAINER] CRITICAL FAIL:", trainErr);
        lastTrainingResult = {
          success: false,
          topic: cleanTopic,
          completedAt: Date.now(),
          error: trainErr.message || "Failed deep co-training sweep."
        };
      } finally {
        isTrainingActive = false;
        console.log(`[BACKGROUND TRAINER] Background auto-train sweep finalized.`);
      }
    })();
  });

  // API: Teach Facts directly to Knowledge Base
  app.post("/api/engine/fact", async (req, res) => {
    const { subject, predicate, object, context } = req.body;
    if (!subject || !predicate || !object) {
      return res.status(400).json({ error: "Missing parameters. Must provide subject, predicate, and object." });
    }

    try {
      const cleanSubject = subject.toLowerCase().trim();
      const cleanPredicate = predicate.toLowerCase().trim();
      const cleanObject = object.toLowerCase().trim();
      const cleanContext = (context || "taught").toLowerCase().trim();

      const newFact: Fact = {
        id: "fa_" + Math.random().toString(36).substring(2, 11),
        subject: cleanSubject,
        predicate: cleanPredicate,
        object: cleanObject,
        rawSource: `Manually taught fact: ${cleanSubject} ${cleanPredicate} ${cleanObject}`,
        confidence: 1.0,
        sourceCount: 1,
        lastVerified: Date.now(),
        context: cleanContext
      };

      // Vector compilation
      const normSub = await normalizeUserInput(cleanSubject);
      const normObj = await normalizeUserInput(cleanObject);

      graph.addOrUpdateNode(cleanSubject, subject.trim(), normSub.estimatedVector, {
        topic: cleanContext,
        tags: [cleanContext],
        confidence: 1.0
      });

      graph.addOrUpdateNode(cleanObject, object.trim(), normObj.estimatedVector, {
        topic: cleanContext,
        tags: [cleanContext],
        confidence: 1.0
      });

      // Add edge
      graph.addEdge(cleanSubject, cleanObject, cleanPredicate, 1.0, 1.0);

      // Add to facts
      const existing = learning.facts.find(
        f => f.subject === cleanSubject && f.predicate === cleanPredicate && f.object === cleanObject
      );

      if (!existing) {
        learning.facts.push(newFact);
        metrics.learnedFacts += 1;
      } else {
        existing.confidence = 1.0;
        existing.lastVerified = Date.now();
      }

      persistChanges();
      res.json({ success: true, fact: newFact });
    } catch (err: any) {
      console.error("Direct learning insertion failing:", err);
      res.status(500).json({ error: err.message || "Failed to catalog learned assertion." });
    }
  });

  // API: Resolve Conflict Manually
  app.post("/api/engine/conflicts/resolve/manual", async (req, res) => {
    const { existingId, incomingId, winner } = req.body;
    if (!existingId || !incomingId || !winner) {
      return res.status(400).json({ error: "Missing required parameters." });
    }

    try {
      const resolved = await learning.applyConflictResolution(existingId, incomingId, winner, graph, 1.0);
      if (resolved) {
        metrics.mistakesResolved += 1;
        persistChanges();
        res.json({ success: true, fact: resolved });
      } else {
        res.status(404).json({ error: "Conflict not found." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to resolve conflict manually." });
    }
  });

  // API: Resolve Conflict autonomously using AI
  app.post("/api/engine/conflicts/resolve/ai", async (req, res) => {
    const { existingId, incomingId } = req.body;
    if (!existingId || !incomingId) {
      return res.status(400).json({ error: "Missing required parameters." });
    }

    try {
      const resolved = await learning.resolveConflictAutonomous(existingId, incomingId, graph);
      if (resolved) {
        metrics.mistakesResolved += 1;
        persistChanges();
        res.json({ success: true, fact: resolved });
      } else {
        res.status(404).json({ error: "Conflict not found or resolution failed." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to resolve conflict autonomously." });
    }
  });

  // API: Resolve ALL unresolved conflicts autonomously using AI
  app.post("/api/engine/conflicts/resolve/all-ai", async (req, res) => {
    try {
      const unresolved = learning.conflicts.filter(c => !c.resolved);
      if (unresolved.length === 0) {
        return res.json({ success: true, count: 0, message: "No unresolved conflicts found." });
      }

      let count = 0;
      for (const conflict of unresolved) {
        try {
          const resolved = await learning.resolveConflictAutonomous(conflict.existing.id, conflict.incoming.id, graph);
          if (resolved) {
            metrics.mistakesResolved += 1;
            count++;
          }
        } catch (singleErr) {
          console.error(`AI Resolution failed for conflict existing [${conflict.existing.id}] vs incoming [${conflict.incoming.id}]`, singleErr);
        }
      }

      if (count > 0) {
        persistChanges();
      }

      res.json({ success: true, count, message: `Successfully resolved ${count} conflicts with AI.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to bulk resolve conflicts." });
    }
  });

  // API: Wipes memory databases completely
  app.post("/api/engine/reset", (req, res) => {
    try {
      storage.clearState();
      
      // Re-instantiate
      graph = new KnowledgeGraph();
      memory = new CognitiveMemory();
      learning = new LearningSystem();
      
      metrics = {
        totalInteractions: 0,
        learnedFacts: 4,
        averageConfidence: 0.95,
        correctionsCount: 0,
        mistakesResolved: 0,
        retrievalSuccessCount: 0
      };

      learning.facts = [
        {
          id: "fa_boot_1",
          subject: "automobile",
          predicate: "is_a",
          object: "vehicle",
          rawSource: "Automobile is a passenger transport vehicle",
          confidence: 0.95,
          sourceCount: 1,
          lastVerified: Date.now(),
          context: "transportation"
        },
        {
          id: "fa_boot_2",
          subject: "python",
          predicate: "is_a",
          object: "programming language",
          rawSource: "Python is a modern high-level scripting language",
          confidence: 0.95,
          sourceCount: 1,
          lastVerified: Date.now(),
          context: "programming"
        },
        {
          id: "fa_boot_3",
          subject: "programming language",
          predicate: "requires",
          object: "logic",
          rawSource: "All programming languages require logical statements",
          confidence: 0.9,
          sourceCount: 1,
          lastVerified: Date.now(),
          context: "programming"
        },
        {
          id: "fa_boot_4",
          subject: "python",
          predicate: "created_by",
          object: "guido",
          rawSource: "Guido van Rossum invented python language in 1991",
          confidence: 1.0,
          sourceCount: 1,
          lastVerified: Date.now(),
          context: "programming"
        }
      ];

      persistChanges();
      res.json({ success: true, message: "Engine storage, facts, and graphs wiped successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Wipe failed." });
    }
  });

  // Vite routing integration for client asset pipelines
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Standard catch-all for single-page routing
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Starlight] Express container listening on http://localhost:${PORT}`);
  });
}

startServer();
