/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  Brain, 
  Cpu, 
  Database, 
  Settings, 
  Zap, 
  PlusCircle, 
  Send, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  FolderOpen, 
  Clock, 
  Compass,
  AlertTriangle,
  Flame,
  User,
  ExternalLink
} from "lucide-react";

import { KnowledgeGraphView } from "./components/KnowledgeGraphView.tsx";
import { CognitiveTrace } from "./components/CognitiveTrace.tsx";
import { MemoryLists } from "./components/MemoryLists.tsx";
import { ReasoningTrace } from "./engine/types.ts";

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "graph" | "memories" | "teach">("chat");
  const [chatMessage, setChatMessage] = useState("");
  const [engineState, setEngineState] = useState<any>(null);
  const [activeTrace, setActiveTrace] = useState<ReasoningTrace | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"online" | "trying" | "offline">("trying");

  // Loading indicators
  const [chatLoading, setChatLoading] = useState(false);
  const [teachLoading, setTeachLoading] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);

  // Teaching input states
  const [teachSubject, setTeachSubject] = useState("");
  const [teachPredicate, setTeachPredicate] = useState("is_a");
  const [teachObject, setTeachObject] = useState("");
  const [teachContext, setTeachContext] = useState("");
  const [teachSuccess, setTeachSuccess] = useState<string | null>(null);
  const [teachError, setTeachError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mount loading
  useEffect(() => {
    fetchHealthCheck();
    fetchEngineState();
  }, []);

  const fetchHealthCheck = async () => {
    try {
      setHealthStatus("trying");
      const res = await fetch("/api/health");
      const data = await res.json();
      if (res.ok) {
        setHealthStatus("online");
        setOfflineMode(data.offlineMode);
      } else {
        setHealthStatus("offline");
      }
    } catch {
      setHealthStatus("offline");
    }
  };

  const fetchEngineState = async () => {
    try {
      const res = await fetch("/api/engine/state");
      if (res.ok) {
        const data = await res.json();
        setEngineState(data);
      }
    } catch (err) {
      console.error("Failed to query full engine state:", err);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatLoading) return;

    setChatLoading(true);
    const textQuery = chatMessage.trim();
    setChatMessage("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textQuery })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setActiveTrace(result.trace);
          // Refetch fresh states
          await fetchEngineState();
        }
      }
    } catch (err) {
      console.error("Failed executing cognitive chat:", err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleTeachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teachSubject.trim() || !teachObject.trim() || teachLoading) return;

    setTeachLoading(true);
    setTeachSuccess(null);
    setTeachError(null);

    try {
      const res = await fetch("/api/engine/fact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: teachSubject.trim(),
          predicate: teachPredicate,
          object: teachObject.trim(),
          context: teachContext.trim() || "manual"
        })
      });

      if (res.ok) {
        setTeachSuccess(`Successfully integrated fact: "${teachSubject} ${teachPredicate} ${teachObject}" into cellular knowledge base!`);
        setTeachSubject("");
        setTeachObject("");
        setTeachContext("");
        // Refetch state
        await fetchEngineState();
      } else {
        const errData = await res.json();
        setTeachError(errData.error || "Failed to inject learned proposition.");
      }
    } catch {
      setTeachError("Unreachable Express server.");
    } finally {
      setTeachLoading(false);
    }
  };

  const handleTriggerWipe = async () => {
    if (!window.confirm("CRITICAL WARNING: This will completely wipe all episodic memory files, learned facts databases, and return the Knowledge Graph to default core state. Proceed?")) return;

    setWipeLoading(true);
    try {
      const res = await fetch("/api/engine/reset", { method: "POST" });
      if (res.ok) {
        setActiveTrace(null);
        alert("Cognitive databases cleaned and restored.");
        await fetchEngineState();
      }
    } catch (err) {
      console.error("Wipe fails:", err);
    } finally {
      setWipeLoading(false);
    }
  };

  return (
    <div id="root-console" className="min-h-screen bg-[#06080d] text-slate-100 flex flex-col selection:bg-emerald-500/25 selection:text-emerald-300">
      
      {/* Dynamic Ambient Blur Background elements */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-slate-500/5 blur-[100px] rounded-full pointer-events-none z-0"></div>

      {/* Main Global Header */}
      <header className="z-10 bg-[#0d1117]/65 border-b border-slate-900/60 p-4 sticky top-0 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-sky-400 rounded-2xl shadow-xl shadow-emerald-500/5 hover-scale">
              <Cpu className="w-6 h-6 text-slate-950 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-extrabold flex items-center gap-1">
                Next-Gen Cognitive Architecture
                <Flame className="w-3 h-3 text-amber-500 inline fill-amber-500" />
              </span>
              <h1 className="font-display font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-slate-50 to-slate-300 tracking-tight flex items-center gap-2">
                STELLIGHT
                <span className="font-mono text-xs text-slate-400 font-semibold border border-slate-800 px-1.5 py-0.5 rounded bg-slate-900/50 uppercase">
                  Sentelum Engine
                </span>
              </h1>
            </div>
          </div>

          {/* Operational Metrics Ribbon */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 z-10 text-xs">
            {/* API Health & Connection Indicators */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-xl font-mono">
              <span className={`w-2 h-2 rounded-full ${
                healthStatus === "online" 
                  ? "bg-emerald-400 animate-pulse" 
                  : healthStatus === "trying" 
                    ? "bg-amber-400 animate-bounce" 
                    : "bg-red-400"
              }`}></span>
              <span className="text-[10px] text-slate-400">
                {healthStatus === "online" 
                  ? (offlineMode ? "OFFLINE CPU MODE" : "GEMINI TEACHER LIVE") 
                  : "UNINITIALIZED"}
              </span>
            </div>

            {/* Total facts learned metric */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-xl font-mono text-slate-400">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Learned: <b className="text-slate-200">{engineState?.metrics?.learnedFacts ?? 4}</b> facts</span>
            </div>

            {/* Total hits metric */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-xl font-mono text-slate-400">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Recall Hits: <b className="text-slate-200">{engineState?.metrics?.totalInteractions ?? 0}</b></span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Layout Area */}
      <main className="z-10 flex-1 max-w-7xl mx-auto w-full px-4 py-6 grid grid-cols-1 gap-6">
        
        {/* Module Nav Tabs */}
        <div className="flex bg-[#0d1117] border border-slate-900 p-1.5 rounded-2xl w-full sm:max-w-md mx-auto shadow-lg shadow-black/20">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === "chat"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-4 h-4" />
            Chat Console
          </button>

          <button
            onClick={() => setActiveTab("graph")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === "graph"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Brain className="w-4 h-4" />
            Graph Matrix
          </button>

          <button
            onClick={() => {
              setActiveTab("memories");
              fetchEngineState();
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === "memories"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            Memories
          </button>

          <button
            onClick={() => setActiveTab("teach")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === "teach"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Teach
          </button>
        </div>

        {/* Tab Module Panels Renders */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-auto"
        >
          {activeTab === "chat" && (
            <div className="space-y-6">
              
              {/* Interactive prompt area */}
              <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                    <Zap className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="font-sans font-bold text-slate-100 text-base">
                      Interactive Cognitive Controller
                    </h2>
                    <p className="text-xs text-slate-400 leading-tight">
                      Express queries to inspect Sentelum vector scores or state assertions (e.g. &quot;Python was created by Guido&quot;)
                    </p>
                  </div>
                </div>

                {/* Main Prompter Forms */}
                <form onSubmit={handleChatSubmit} className="flex gap-2 relative">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask Stellight anything or teach it a relationship..."
                    disabled={chatLoading}
                    className="flex-1 bg-[#090d14]/90 border border-slate-800 focus:border-emerald-500/40 rounded-xl px-4 py-3 text-slate-200 text-sm outline-none transition-colors placeholder:text-slate-500 font-sans"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatMessage.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    {chatLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Exile Query
                      </>
                    )}
                  </button>
                </form>

                {/* Prompt ideas buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[10px] font-mono text-slate-400">
                  <span className="mr-1">TRY SUGGESTIONS:</span>
                  {[
                    "What's an automobile?",
                    "Python was created by Guido",
                    "Is Python a programming language?",
                    "Python was created by Elon Musk"
                  ].map((phrase, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setChatMessage(phrase)}
                      className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700/60 text-slate-300 transition-colors cursor-pointer"
                    >
                      &ldquo;{phrase}&rdquo;
                    </button>
                  ))}
                </div>
              </div>

              {/* Show the step path trace debug stepper */}
              <CognitiveTrace trace={activeTrace} />
            </div>
          )}

          {activeTab === "graph" && (
            <KnowledgeGraphView 
              nodes={engineState?.nodes ?? []} 
              edges={engineState?.edges ?? []} 
            />
          )}

          {activeTab === "memories" && (
            <MemoryLists 
              facts={engineState?.facts ?? []}
              shortTerm={engineState?.shortTerm ?? []}
              episodic={engineState?.episodic ?? []}
              semantic={engineState?.semantic ?? []}
              conflicts={engineState?.conflicts ?? []}
            />
          )}

          {activeTab === "teach" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Teaching panel Form */}
              <div className="lg:col-span-2 bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-1.5 bg-sky-500/10 text-[#60a5fa] rounded-lg border border-sky-500/20">
                    <PlusCircle className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="font-sans font-bold text-slate-100 text-base">
                      Catalog Core Proposition
                    </h2>
                    <p className="text-xs text-slate-400">
                      Instantly teach the engine high-fidelity structural facts to insert into the Knowledge Graph
                    </p>
                  </div>
                </div>

                {/* Submitting responses warnings */}
                {teachSuccess && (
                  <div className="p-3 bg-emerald-950/15 border border-emerald-900/30 text-emerald-400 rounded-xl font-sans text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    {teachSuccess}
                  </div>
                )}
                
                {teachError && (
                  <div className="p-3 bg-red-950/15 border border-red-900/30 text-red-400 rounded-xl font-sans text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {teachError}
                  </div>
                )}

                <form onSubmit={handleTeachSubmit} className="space-y-4 text-xs font-mono">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    
                    {/* Subject field */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400 uppercase tracking-widest block font-bold text-[9px]">
                        Subject Concept (Noun)
                      </label>
                      <input
                        type="text"
                        value={teachSubject}
                        onChange={(e) => setTeachSubject(e.target.value)}
                        placeholder="e.g. Python"
                        required
                        className="w-full bg-[#090d14]/90 border border-slate-850 border-slate-800 focus:border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-slate-100 font-sans outline-none outline-0"
                      />
                    </div>

                    {/* Predicate relation connector select */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400 uppercase tracking-widest block font-bold text-[9px]">
                        Predicate Relationship
                      </label>
                      <select
                        value={teachPredicate}
                        onChange={(e) => setTeachPredicate(e.target.value)}
                        className="w-full bg-[#090d14]/90 border border-slate-850 border-slate-800 focus:border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-slate-300 font-sans outline-none outline-0 cursor-pointer"
                      >
                        <option value="is_a">is_a (Classification)</option>
                        <option value="created_by">created_by (Invention)</option>
                        <option value="requires">requires (Dependency)</option>
                        <option value="part_of">part_of (Composition)</option>
                        <option value="related_to">related_to (Ambient association)</option>
                        <option value="similar_to">similar_to (Synonym relation)</option>
                        <option value="causes">causes (Process relation)</option>
                      </select>
                    </div>

                    {/* Object concept field */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400 uppercase tracking-widest block font-bold text-[9px]">
                        Object Assertion (Target)
                      </label>
                      <input
                        type="text"
                        value={teachObject}
                        onChange={(e) => setTeachObject(e.target.value)}
                        placeholder="e.g. Guido van Rossum"
                        required
                        className="w-full bg-[#090d14]/90 border border-slate-850 border-slate-800 focus:border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-slate-100 font-sans outline-none outline-0"
                      />
                    </div>

                  </div>

                  {/* Context optional tags */}
                  <div className="space-y-1.5 w-full sm:max-w-xs">
                    <label className="text-slate-400 uppercase tracking-widest block font-bold text-[9px]">
                      Thematic Domain (Topic Context)
                    </label>
                    <input
                      type="text"
                      value={teachContext}
                      onChange={(e) => setTeachContext(e.target.value)}
                      placeholder="e.g. computer science"
                      className="w-full bg-[#090d14]/90 border border-slate-850 border-slate-800 focus:border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-slate-100 font-sans outline-none outline-0"
                    />
                  </div>

                  {/* Trigger teach insert button */}
                  <div className="border-t border-slate-800/50 pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={teachLoading || !teachSubject.trim() || !teachObject.trim()}
                      className="bg-[#60a5fa] hover:bg-[#3b82f6] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide disabled:cursor-not-allowed"
                    >
                      {teachLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <PlusCircle className="w-4 h-4" />
                          Commit Proposition
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>

              {/* Advanced configuration / reset database card */}
              <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                  <Settings className="w-5 h-5 text-slate-400" />
                  <h3 className="font-sans font-bold text-sm text-slate-200">
                    Engine Management
                  </h3>
                </div>

                <div className="space-y-3.5 text-xs leading-normal">
                  <div className="space-y-1 bg-[#12161f]/70 border border-slate-800/45 p-3 rounded-xl">
                    <span className="text-[10px] font-mono text-slate-500 font-bold block uppercase">DATA INTEGRITY SECURITY</span>
                    <p className="text-slate-400 font-sans">
                      Persistence layer uses JSON databases. Active session values reside locally and are completely secured.
                    </p>
                  </div>

                  <div className="space-y-2 border-t border-slate-900 pt-3">
                    <span className="text-[10px] font-mono text-red-400 font-bold block uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Destructive Maintenance
                    </span>
                    <p className="text-slate-500 font-sans text-[11px] leading-tight">
                      Wipe states to dump active files and reload graph defaults.
                    </p>
                    
                    <button
                      onClick={handleTriggerWipe}
                      disabled={wipeLoading}
                      className="w-full bg-red-500/10 hover:bg-red-500/15 border border-red-500/25 text-red-400 font-bold py-2.5 rounded-xl transition-all font-mono text-[10px] uppercase tracking-wider cursor-pointer"
                    >
                      {wipeLoading ? "WIPING COGNITIVE STATES..." : "RESET COGNITIVE ENGINE"}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </motion.div>

      </main>

      {/* Global Footer */}
      <footer className="bg-[#07090e] border-t border-slate-950 p-4 text-center text-xs text-slate-500 font-mono flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto w-full z-10">
        <p>© 2026 Stellight Sentelum Engine. All rights reserved.</p>
        <div className="flex bg-[#0f121a] px-3 py-1.5 border border-slate-800 rounded-lg text-[10px] items-center gap-2 font-mono">
          <Brain className="w-3.5 h-3.5 text-emerald-400" />
          <span>Active Cognitive Nodes: {engineState?.nodes?.length ?? 0} | Facts cataloged: {engineState?.facts?.length ?? 0}</span>
        </div>
      </footer>

    </div>
  );
}
