/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Zap, 
  CheckCircle, 
  XCircle, 
  Key, 
  RefreshCw, 
  Settings, 
  Info, 
  Layers, 
  Cpu, 
  ShieldAlert, 
  Play, 
  Activity, 
  Check, 
  HelpCircle 
} from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  models: string[];
  selectedModel: string;
  keys: string[];
  keyIndex: number;
  apiUrl?: string;
}

interface APIConsoleProps {
  engineState?: any;
  onFetchEngineState?: () => void;
}

export function APIConsole({ engineState, onFetchEngineState }: APIConsoleProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [execMode, setExecMode] = useState<"waterfall" | "multithread">("multithread");
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency?: number; error?: string }>>({});
  
  // Edit key states
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [keysInput, setKeysInput] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Cognitive Settings States
  const [temperature, setTemperature] = useState<number>(() => {
    const saved = localStorage.getItem("stellight_temp");
    return saved ? parseFloat(saved) : 0.7;
  });
  const [deductiveDepth, setDeductiveDepth] = useState<number>(() => {
    const saved = localStorage.getItem("stellight_depth");
    return saved ? parseInt(saved) : 5;
  });
  const [attentionWeight, setAttentionWeight] = useState<number>(() => {
    const saved = localStorage.getItem("stellight_attention");
    return saved ? parseInt(saved) : 85;
  });
  const [autoRotate, setAutoRotate] = useState<boolean>(() => {
    const saved = localStorage.getItem("stellight_auto_rotate");
    return saved !== "false";
  });

  const handleSetTemperature = (val: number) => {
    setTemperature(val);
    localStorage.setItem("stellight_temp", val.toString());
  };
  const handleSetDeductiveDepth = (val: number) => {
    setDeductiveDepth(val);
    localStorage.setItem("stellight_depth", val.toString());
  };
  const handleSetAttentionWeight = (val: number) => {
    setAttentionWeight(val);
    localStorage.setItem("stellight_attention", val.toString());
  };
  const handleSetAutoRotate = (val: boolean) => {
    val ? setAutoRotate(true) : setAutoRotate(false);
    localStorage.setItem("stellight_auto_rotate", val.toString());
  };

  // Dynamic real-time training states synced to background process
  const isTraining = engineState?.isTrainingActive ?? false;
  const trainingResult = engineState?.lastTrainingResult ?? null;
  const [trainTopic, setTrainTopic] = useState("");
  const [trainingError, setTrainingError] = useState<string | null>(null);

  // .env Import States
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [envText, setEnvText] = useState("");
  const [importingEnv, setImportingEnv] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState("");
  const [importErrorMsg, setImportErrorMsg] = useState("");

  const parseEnvText = (text: string) => {
    const lines = text.split("\n");
    const parsedKeys: Record<string, string[]> = {};

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;

      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;

      const keyName = line.substring(0, eqIdx).trim().toUpperCase();
      let val = line.substring(eqIdx + 1).trim();

      // Strip leading and trailing quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.substring(1, val.length - 1);
      }

      // Split on commas/semicolons and trim
      const parts = val.split(/[;;,]/).map(p => p.trim()).filter(p => p.length > 0);
      
      let providerId = "";
      if (keyName.includes("GEMINI")) providerId = "gemini";
      else if (keyName.includes("GROQ")) providerId = "groq";
      else if (keyName.includes("OPENROUTER")) providerId = "openrouter";
      else if (keyName.includes("HUGGINGFACE") || keyName.includes("HF_")) providerId = "huggingface";
      else if (keyName.includes("CEREBRAS")) providerId = "cerebras";
      else if (keyName.includes("COHERE")) providerId = "cohere";
      else if (keyName.includes("MISTRAL")) providerId = "mistral";

      if (providerId && parts.length > 0) {
        parsedKeys[providerId] = parts;
      }
    }
    return parsedKeys;
  };

  const handleImportEnv = async () => {
    setImportingEnv(true);
    setImportSuccessMsg("");
    setImportErrorMsg("");

    const parsed = parseEnvText(envText);
    const keysParsed = Object.keys(parsed);

    if (keysParsed.length === 0) {
      setImportErrorMsg("No valid API keys found. Please ensure you paste lines in the format: PROVIDER_API_KEY=\"key1, key2\"");
      setImportingEnv(false);
      return;
    }

    try {
      let count = 0;
      for (const [id, keys] of Object.entries(parsed)) {
        const res = await fetch("/api/engine/providers/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, keys, enabled: true })
        });
        if (res.ok) {
          count++;
        }
      }
      
      setImportSuccessMsg(`Successfully imported key pools for ${count} providers and enabled them!`);
      setEnvText("");
      await fetchProviders();
      setTimeout(() => {
        setShowEnvModal(false);
        setImportSuccessMsg("");
      }, 2500);
    } catch (err: any) {
      setImportErrorMsg(err.message || "An error occurred while linking your keys.");
    } finally {
      setImportingEnv(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleAutoTrain = async () => {
    setTrainingError(null);
    try {
      const res = await fetch("/api/engine/autotrain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trainTopic })
      });
      const data = await res.json();
      if (data.success) {
        // Clear input and instantly notify parent so background training shows in real-time
        setTrainTopic("");
        if (onFetchEngineState) {
          onFetchEngineState();
        }
      } else {
        setTrainingError(data.error || "Collaborative co-training returned an unusual error.");
      }
    } catch (err) {
      setTrainingError("Failed to establish server communication with training pipeline.");
    }
  };

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/engine/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setExecMode(data.mode || "multithread");
      }
    } catch (err) {
      console.error("Failed to fetch provider endpoints:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProvider = async (id: string, currentlyEnabled: boolean) => {
    try {
      const res = await fetch("/api/engine/providers/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: !currentlyEnabled })
      });
      if (res.ok) {
        await fetchProviders();
      }
    } catch (err) {
      console.error("Failed to toggle provider status:", err);
    }
  };

  const handleChangeModel = async (id: string, model: string) => {
    try {
      const res = await fetch("/api/engine/providers/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, selectedModel: model })
      });
      if (res.ok) {
        await fetchProviders();
      }
    } catch (err) {
      console.error("Failed to update model settings:", err);
    }
  };

  const handleUpdateKeys = async (id: string) => {
    setUpdatingId(id);
    const keysArray = keysInput
      .split(/[,\n]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    try {
      const res = await fetch("/api/engine/providers/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, keys: keysArray })
      });
      if (res.ok) {
        setEditingProviderId(null);
        setKeysInput("");
        await fetchProviders();
      }
    } catch (err) {
      console.error("Failed to update API key rotation pool:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTestProvider = async (id: string) => {
    setTestingId(id);
    setTestResults(prev => ({ ...prev, [id]: undefined }));
    try {
      const res = await fetch("/api/engine/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const data = await res.json();
        setTestResults(prev => ({
          ...prev,
          [id]: {
            success: data.success,
            latency: data.latencyMs,
            error: data.error
          }
        }));
      }
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [id]: { success: false, error: "Server unreachable" }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleChangeMode = async (mode: "waterfall" | "multithread") => {
    try {
      const res = await fetch("/api/engine/providers/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        setExecMode(mode);
      }
    } catch (err) {
      console.error("Failed to update routing mode:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Operational Control Header */}
      <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="font-sans font-bold text-base text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            Parallel LLM Multi-Routing Studio
          </h3>
          <p className="text-xs text-slate-400">
            Configure dynamic api keys, select fast engines, and test failover latencies.
          </p>
        </div>

        {/* Dynamic Multi-threading and waterfall control selectors */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 h-fit">
          <button
            onClick={() => setShowEnvModal(true)}
            className="px-4 py-2 bg-[#161b22] hover:bg-slate-800 border border-slate-800 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
          >
            <Key className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            .env Import
          </button>

          <div className="flex bg-[#161b22] border border-slate-800 p-1 rounded-xl shrink-0 h-fit">
            <button
              onClick={() => handleChangeMode("multithread")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                execMode === "multithread"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Dual-Concurrent Trace (Multi-threaded)
            </button>
            <button
              onClick={() => handleChangeMode("waterfall")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                execMode === "waterfall"
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Waterfall Failover (Sequential)
            </button>
          </div>
        </div>
      </div>

      {/* Synaptic Co-Training Hub */}
      <div className="bg-[#0c1017]/90 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Abstract background blur effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-5 border-b border-slate-800/60">
          <div className="space-y-1">
            <h3 className="font-sans font-bold text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              Dynamic Synaptic Co-Training Studio (Multi-Threaded)
            </h3>
            <p className="text-xs text-slate-400">
              Launch live co-training cycles. All enabled models collaborate concurrently in parallel to research, verify, and cross-map concepts.
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <input
              type="text"
              value={trainTopic}
              onChange={(e) => setTrainTopic(e.target.value)}
              placeholder="e.g. quantum cryptography, deep learning"
              className="flex-1 md:w-80 bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-emerald-500/40 rounded-xl px-4 py-2 text-slate-200 text-xs font-sans outline-none shadow-inner"
              disabled={isTraining}
            />
            <button
              onClick={handleAutoTrain}
              disabled={isTraining}
              className="px-5 py-2.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-xs font-bold uppercase tracking-wide rounded-xl transition-all shadow-lg active:scale-98 flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isTraining ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  CO-TRAINING...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  TRAIN MODEL
                </>
              )}
            </button>
          </div>
        </div>

        {/* Training Results Presentation */}
        {isTraining && (
          <div className="mt-6 p-4 bg-[#141b26]/50 border border-slate-800/40 rounded-2xl flex flex-col items-center justify-center text-center py-12 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-emerald-500/10 border-t-emerald-400 animate-spin flex items-center justify-center" />
              <Layers className="w-6 h-6 text-emerald-400 animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="space-y-1 max-w-md">
              <span className="text-xs font-semibold text-emerald-400 animate-pulse font-mono block uppercase">
                Active Multi-Threaded Raced Core Operational
              </span>
              <p className="text-[11px] text-slate-400">
                Pinging {providers.filter(p => p.enabled && p.keys.length > 0).map(p => p.name).join(", ") || "enabled nodes"} in parallel. Fusing concepts, correcting conceptual anomalies, and upgrading synaptic matrix...
              </p>
            </div>
          </div>
        )}

        {trainingError && (
          <div className="mt-5 p-4 bg-red-950/20 border border-red-900/30 text-red-400 rounded-2xl text-xs font-mono flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="font-bold uppercase text-[10px]">Co-Training Disruption</p>
              <p className="mt-0.5 text-slate-400 leading-relaxed">{trainingError}</p>
            </div>
          </div>
        )}

        {trainingResult && (
          <div className="mt-6 space-y-5 animate-fadeIn">
            {/* Success summary counts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#111622]/80 border border-slate-800/60 rounded-xl p-3.5 font-sans">
                <span className="text-[10px] text-slate-500 uppercase block font-bold font-mono">Research Domain</span>
                <span className="font-sans font-bold text-slate-200 text-sm">{trainingResult.topic}</span>
              </div>
              <div className="bg-[#111622]/80 border border-slate-800/60 rounded-xl p-3.5 font-sans">
                <span className="text-[10px] text-slate-500 uppercase block font-bold font-mono">Raced Active Channels</span>
                <span className="font-sans font-bold text-slate-200 text-sm">{trainingResult.activeChannelsCount} Nodes Synced</span>
              </div>
              <div className="bg-[#111622]/80 border border-slate-800/60 rounded-xl p-3.5 font-sans">
                <span className="text-[10px] text-slate-500 uppercase block font-bold font-mono">Consensus Facts Extracted</span>
                <span className="font-sans font-bold text-emerald-400 text-sm">+{trainingResult.factsLearned?.length || 0} Learned</span>
              </div>
            </div>

            {/* Detailed trace tabs */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                Multi-Threaded Raced Nodes Trace logs:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Channels Latency & Response Codes Log */}
                <div className="bg-[#090d14] border border-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-2.5 max-h-[220px] overflow-y-auto">
                  <span className="text-slate-500 text-[10px] uppercase block font-bold border-b border-slate-900/60 pb-1.5 flex items-center justify-between">
                    <span>CO-TRAINING TELEMETRY</span>
                    <span className="text-emerald-400">ONLINE</span>
                  </span>
                  {trainingResult.results?.map((r: any) => (
                    <div key={r.providerId} className="flex justify-between items-center py-1 border-b border-slate-950/60">
                      <span className="font-bold text-slate-400 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${r.success ? "bg-emerald-400" : "bg-red-400"}`} />
                        {r.providerName}
                      </span>
                      <div className="text-right text-[10px]">
                        {r.success ? (
                          <span className="text-emerald-400 font-bold">SUCCESS ({r.latency}ms)</span>
                        ) : (
                          <span className="text-red-400 font-bold">FAIL ({r.error})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Extracted and synthesized fact cards */}
                <div className="bg-[#090d14] border border-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-2.5 max-h-[220px] overflow-y-auto">
                  <span className="text-slate-500 text-[10px] uppercase block font-bold border-b border-slate-900/60 pb-1.5 flex items-center justify-between">
                    <span>CELLULAR COGNITIVE REINFORCEMENTS</span>
                    <span className="text-indigo-400">COMPLETED</span>
                  </span>
                  {trainingResult.factsLearned && trainingResult.factsLearned.length > 0 ? (
                    trainingResult.factsLearned.map((f: any, idx: number) => (
                      <div key={idx} className="space-y-1 py-1.5 border-b border-slate-950/60">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase">
                            {f.provider}
                          </span>
                          <span className="text-slate-200 font-bold">
                            {f.fact}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">
                          {f.source} (Confidence: {f.confidence})
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic text-center py-4">No new facts parsed during this cycle.</div>
                  )}
                </div>
              </div>

              {/* 5 Complementary Learning Heuristic Engines Dashboard */}
              {trainingResult.heuristicsReport && (
                <div className="space-y-4 pt-2">
                  <h5 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 bg-emerald-400 animate-ping rounded-full" />
                    INTEGRATED COGNITIVE ENGINES (HEURISTICS SWEEP COMPLETED)
                  </h5>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-[#090d14] border border-slate-900 rounded-xl p-3 text-center">
                      <span className="text-[9px] text-slate-500 block uppercase font-mono font-semibold">1. Syllogistic Deduction</span>
                      <span className="text-sm font-bold text-emerald-400 block mt-1">+{trainingResult.heuristicsReport.deductiveLearned} relations</span>
                      <span className="text-[8px] text-slate-600 block mt-0.5">Transitive inference [A is B, B is C]</span>
                    </div>
                    <div className="bg-[#090d14] border border-slate-900 rounded-xl p-3 text-center">
                      <span className="text-[9px] text-slate-500 block uppercase font-mono font-semibold">2. Concept Inductor</span>
                      <span className="text-sm font-bold text-teal-400 block mt-1">+{trainingResult.heuristicsReport.inductiveLearned} links</span>
                      <span className="text-[8px] text-slate-600 block mt-0.5">Abstract context grouping</span>
                    </div>
                    <div className="bg-[#090d14] border border-slate-900 rounded-xl p-3 text-center">
                      <span className="text-[9px] text-slate-500 block uppercase font-mono font-semibold">3. Entropy Pruning</span>
                      <span className="text-sm font-bold text-amber-500 block mt-1">-{trainingResult.heuristicsReport.entropyPruned} anomalies</span>
                      <span className="text-[8px] text-slate-600 block mt-0.5">Self-healing contradiction sweep</span>
                    </div>
                    <div className="bg-[#090d14] border border-slate-900 rounded-xl p-3 text-center">
                      <span className="text-[9px] text-slate-500 block uppercase font-mono font-semibold">4. Analogy Alignment</span>
                      <span className="text-sm font-bold text-indigo-400 block mt-1">+{trainingResult.heuristicsReport.analogiesMapped} maps</span>
                      <span className="text-[8px] text-slate-600 block mt-0.5">Domain role structural alignment</span>
                    </div>
                    <div className="bg-[#090d14] border border-slate-900 rounded-xl p-3 text-center">
                      <span className="text-[9px] text-slate-500 block uppercase font-mono font-semibold">5. Density Weighting</span>
                      <span className="text-sm font-bold text-sky-400 block mt-1">{trainingResult.heuristicsReport.densityStrengthened} nodes</span>
                      <span className="text-[8px] text-slate-600 block mt-0.5">Frequency co-occurrence boost</span>
                    </div>
                  </div>

                  {/* Terminal Execution Logs */}
                  <div className="bg-slate-950/70 border border-slate-900 rounded-xl p-3.5 max-h-[140px] overflow-y-auto styled-scrollbar font-mono text-[10px] text-slate-400 space-y-1">
                    <p className="text-slate-600 border-b border-slate-900 pb-1.5 mb-1.5 uppercase tracking-wide flex justify-between">
                      <span>HEURISTIC COGNITIVE INTELLIGENCE TERMINAL</span>
                      <span className="text-emerald-500">READY</span>
                    </p>
                    {trainingResult.heuristicsReport.heuristicLogs && trainingResult.heuristicsReport.heuristicLogs.length > 0 ? (
                      trainingResult.heuristicsReport.heuristicLogs.map((logLine: string, li: number) => {
                        let colorClass = "text-slate-300";
                        if (logLine.startsWith("[Deduction]")) colorClass = "text-emerald-400";
                        if (logLine.startsWith("[Inductive Category]")) colorClass = "text-teal-400";
                        if (logLine.startsWith("[Entropy Pruning]")) colorClass = "text-amber-400";
                        if (logLine.startsWith("[Analogy Alignment]")) colorClass = "text-indigo-400";
                        return (
                          <div key={li} className="flex gap-2">
                            <span className="text-slate-650 font-bold">»</span>
                            <p className={colorClass}>{logLine}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-slate-600 italic">No structural shifts occurred in local heuristics pass.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Core Providers Configuration List */}
        <div className="lg:col-span-3 space-y-4">
          {loading && providers.length === 0 ? (
            <div className="flex justify-center items-center py-20 bg-[#0c1017]/85 border border-slate-800 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-slate-500 animate-spin" />
            </div>
          ) : (
            providers.map((prov) => {
              const test = testResults[prov.id];
              const isEditing = editingProviderId === prov.id;
              
              return (
                <div 
                  key={prov.id}
                  className={`bg-[#0c1017]/85 border rounded-2xl p-5 transition-all duration-300 ${
                    prov.enabled 
                      ? "border-slate-800 hover:border-slate-700/80" 
                      : "border-slate-900/60 opacity-65 hover:opacity-85"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    
                    {/* Brand Status Controls */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={prov.enabled}
                        onChange={() => handleToggleProvider(prov.id, prov.enabled)}
                        className="w-4 h-4 text-emerald-500 bg-slate-950 border-slate-800 rounded focus:ring-emerald-500/30 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-sans font-bold text-slate-100 text-sm">
                            {prov.name}
                          </h4>
                          {prov.keys.length > 0 && prov.enabled && (
                            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/15">
                              {prov.keys.length} KEYS ACTIVE (Rotating)
                            </span>
                          )}
                          {prov.keys.length === 0 && prov.id !== "ollama" && (
                            <span className="bg-amber-500/10 text-amber-500 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/15">
                              No Keys Added
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5 uppercase">
                          ID: {prov.id} | Api Endpoint: {prov.apiUrl || "Direct Platform Proxy"}
                        </p>
                      </div>
                    </div>

                    {/* Quick Config Select & Test Buttons */}
                    {prov.enabled && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* Select Model */}
                        <select
                          value={prov.selectedModel}
                          onChange={(e) => handleChangeModel(prov.id, e.target.value)}
                          className="flex-1 sm:flex-initial bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 font-sans outline-none focus:border-emerald-500/45 cursor-pointer max-w-[200px] truncate"
                        >
                          {prov.models.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>

                        {/* Test Connection Button */}
                        <button
                          onClick={() => handleTestProvider(prov.id)}
                          disabled={testingId !== null}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 text-[11px] font-mono font-bold border border-slate-800 hover:border-slate-700/60 rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          {testingId === prov.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "TEST LATENCY"
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Test Result Indicator Messages */}
                  {test && (
                    <div className={`mt-3.5 py-2 px-3 border rounded-xl text-xs font-mono flex items-center gap-2 ${
                      test.success 
                        ? "bg-emerald-950/15 border-emerald-900/35 text-emerald-400" 
                        : "bg-red-950/15 border-red-900/35 text-red-400"
                    }`}>
                      {test.success ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Tested Succeeded! Active response channel benchmark latency: <b>{test.latency}ms</b>. API verified online.</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span className="truncate">Failure connecting: <b>{test.error || "Internal response timeout"}</b>. Rotating keys pool.</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* API Keys Rotation Panel */}
                  {prov.enabled && (
                    <div className="mt-4 pt-3.5 border-t border-slate-900/60 text-xs font-mono">
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <label className="text-slate-400 text-[10px] uppercase block font-bold">
                            API Key Pool (Comma or Newline separated keys)
                          </label>
                          <textarea
                            value={keysInput}
                            onChange={(e) => setKeysInput(e.target.value)}
                            placeholder="Paste multiple keys (e.g., sk-...,sk-...) to support failover tier exhaustion."
                            rows={3}
                            className="w-full bg-[#090d14]/90 border border-slate-800 focus:border-emerald-500/40 rounded-xl p-3 text-slate-100 font-mono text-xs outline-none shadow-md"
                          />
                          <div className="flex justify-end gap-2 text-[10px] font-bold uppercase font-mono">
                            <button
                              onClick={() => {
                                setEditingProviderId(null);
                                setKeysInput("");
                              }}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-lg text-[10px]"
                            >
                              CANCEL
                            </button>
                            <button
                              onClick={() => handleUpdateKeys(prov.id)}
                              disabled={updatingId !== null}
                              className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-lg text-[10px] flex items-center gap-1 font-bold"
                            >
                              {updatingId === prov.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "SAVE ALL TO POOL"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px]">
                          <div className="flex items-center gap-1.5 text-slate-400 max-w-full overflow-hidden">
                            <Key className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Rotating Keys List:</span>
                            {prov.keys.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-lg">
                                {prov.keys.map((k, idx) => (
                                  <span 
                                    key={idx} 
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                      idx === prov.keyIndex % prov.keys.length
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : "bg-slate-900 text-slate-500 border-slate-800"
                                    }`}
                                  >
                                    [{idx}] {k.substring(0, 8)}...{k.substring(k.length - 4)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">[None Configured]</span>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setEditingProviderId(prov.id);
                              setKeysInput(prov.keys.join(", "));
                            }}
                            className="text-emerald-400 hover:text-emerald-300 font-bold uppercase text-[10px] flex items-center gap-1 self-end sm:self-auto hover:underline"
                          >
                            <Settings className="w-3 h-3" />
                            Manage Keys ({prov.keys.length})
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Informational Guidance Sidebar + Hyperparameter tuning dashboard */}
        <div className="space-y-6">
          <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="border-b border-slate-800/80 pb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              <h4 className="font-sans font-bold text-sm text-slate-200">
                Cognitive Tuning Panel
              </h4>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Temperature setting */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">CREATIVE TEMPERATURE</span>
                  <span className="text-emerald-400 font-bold">{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => handleSetTemperature(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg appearance-none"
                />
                <span className="text-[8px] text-slate-550 block italic">
                  {temperature <= 0.3 ? "Deterministic, factual responses" : temperature <= 0.7 ? "Balanced fact-finding reasoning" : "Creative, imaginative associations"}
                </span>
              </div>

              {/* Deductive Depth relation setting */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">DEDUCTION STEP DEPTH</span>
                  <span className="text-sky-400 font-bold">{deductiveDepth} Hops</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={deductiveDepth}
                  onChange={(e) => handleSetDeductiveDepth(parseInt(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg appearance-none"
                />
                <span className="text-[8px] text-slate-550 block italic">
                  Max graph path iteration limit during query traversal.
                </span>
              </div>

              {/* Attention Focus weight percentage */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">ATTENTION RETENTION WEIGHT</span>
                  <span className="text-indigo-400 font-bold">{attentionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={attentionWeight}
                  onChange={(e) => handleSetAttentionWeight(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg appearance-none"
                />
                <span className="text-[8px] text-slate-550 block italic">
                  Stochastic weights distribution across nearest node vectors.
                </span>
              </div>

              {/* AI Key Auto-Rotate pool lock */}
              <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-xl border border-slate-900">
                <div className="flex flex-col">
                  <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">FORCED ROTATION</span>
                  <span className="text-[8px] text-slate-500 font-sans">Cycle keys on failures</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => handleSetAutoRotate(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 bg-slate-950 border-slate-800 rounded focus:ring-emerald-500/30 cursor-pointer"
                />
              </div>

            </div>
          </div>
          <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="border-b border-slate-800/80 pb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400" />
              <h4 className="font-sans font-bold text-sm text-slate-200">
                Architecture overview
              </h4>
            </div>

            <div className="space-y-3.5 text-xs text-slate-400 leading-normal font-sans">
              <p>
                Starlight supports **Multi-threaded Parallel Raced** prompts. When multiple models are enabled, it triggers requests at the same time and races them inside Node.js.
              </p>

              <div className="bg-[#12161f] p-3 rounded-xl border border-slate-800/60 font-mono space-y-2 text-[11px]">
                <span className="text-emerald-400 font-bold block flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  CONCURRENCY PROTECTION
                </span>
                <p className="text-slate-500 text-[10px] leading-tight">
                  If any single model hits a rate-limit, exhaustion, or times out, Starlight automatically ignores the failure and returns the fastest complete answer from another channel.
                </p>
              </div>

              <div className="bg-[#12161f] p-3 rounded-xl border border-slate-800/60 font-mono space-y-2 text-[11px]">
                <span className="text-sky-400 font-bold block flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  KEY ROTATION POOLS
                </span>
                <p className="text-slate-500 text-[10px] leading-tight">
                  Add multiple API keys separated by commas. Starlight will cycle to the next key on any failure, ensuring near-infinite tier uptime!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* `.env` Batch Keys Import Modal Overlay */}
      {showEnvModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0c1017] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
          >
            <div className="border-b border-slate-850 p-4 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <h3 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider">Batch .env Configuration Import</h3>
              </div>
              <button
                onClick={() => setShowEnvModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Paste the contents of your `.env` configuration file below. Any keys for <span className="text-emerald-400 font-semibold">Gemini, Groq, OpenRouter, Hugging Face, Cerebras, Cohere, or Mistral</span> will be extracted, updated, and enabled in your dynamic rotation pools automatically.
              </p>

              <div className="space-y-1">
                <textarea
                  value={envText}
                  onChange={(e) => setEnvText(e.target.value)}
                  placeholder={`GEMINI_API_KEY="AIzaSy..."\nCEREBRAS_API_KEY="csk-..."\nMISTRAL_API_KEY="..."`}
                  className="w-full h-48 bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-emerald-500/40 rounded-xl p-3.5 text-[11px] font-mono text-slate-300 outline-none resize-none shadow-inner"
                />
                <span className="text-[10px] text-slate-500 block font-mono">Quotes, whitespaces, and comments are stripped automatically. Multiple keys can be comma-separated.</span>
              </div>

              {importErrorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs font-sans">
                  {importErrorMsg}
                </div>
              )}

              {importSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs font-sans animate-pulse">
                  {importSuccessMsg}
                </div>
              )}
            </div>

            <div className="bg-[#12161f]/40 border-t border-slate-850 p-4 flex justify-end gap-2.5">
              <button
                onClick={() => setShowEnvModal(false)}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={importingEnv || !envText.trim()}
                onClick={handleImportEnv}
                className="px-4 py-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 font-bold uppercase text-[11px] font-mono tracking-wide rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-97"
              >
                {importingEnv ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Parse & Save pools
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
