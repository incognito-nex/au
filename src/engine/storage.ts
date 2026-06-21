/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { Node, Edge, Fact, MemoryChunk, SystemMetrics } from "./types.js";
import { KnowledgeGraph } from "./knowledge.js";
import { CognitiveMemory } from "./memory.js";
import { LearningSystem } from "./learning.js";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "starlight_store.json");

export interface SerializedState {
  nodes: Node[];
  edges: Edge[];
  facts: Fact[];
  shortTerm: MemoryChunk[];
  episodic: MemoryChunk[];
  semantic: MemoryChunk[];
  metrics: SystemMetrics;
  conflicts: any[];
}

export class EngineStorage {
  constructor() {
    this.ensureDataDirectories();
  }

  private ensureDataDirectories() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * Saves the entire cognitive status to filesystem.
   */
  public saveState(params: {
    graph: KnowledgeGraph;
    memory: CognitiveMemory;
    learning: LearningSystem;
    metrics: SystemMetrics;
  }): boolean {
    try {
      this.ensureDataDirectories();
      const state: SerializedState = {
        nodes: Array.from(params.graph.nodes.values()),
        edges: params.graph.edges,
        facts: params.learning.facts,
        shortTerm: params.memory.shortTerm,
        episodic: params.memory.episodic,
        semantic: params.memory.semantic,
        metrics: params.metrics,
        conflicts: params.learning.conflicts
      };

      fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.error("Failed to persist Starlight state:", err);
      return false;
    }
  }

  /**
   * Restores cognitive state from filesystem.
   */
  public loadState(): SerializedState | null {
    try {
      if (!fs.existsSync(STORE_FILE)) return null;
      const content = fs.readFileSync(STORE_FILE, "utf-8");
      return JSON.parse(content) as SerializedState;
    } catch (err) {
      console.error("Failed to read Starlight state from file:", err);
      return null;
    }
  }

  /**
   * Wipes database files and resets memory state.
   */
  public clearState(): boolean {
    try {
      if (fs.existsSync(STORE_FILE)) {
        fs.unlinkSync(STORE_FILE);
      }
      return true;
    } catch (err) {
      console.error("Failed to reset database files:", err);
      return false;
    }
  }
}
