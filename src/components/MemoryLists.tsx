/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { MemoryChunk, Fact } from "../engine/types.ts";
import { Database, AlertTriangle, BookOpen, Clock, Activity, ShieldCheck } from "lucide-react";

interface ConflictItem {
  existing: Fact;
  incoming: Fact;
  resolved: boolean;
  winnerId?: string;
}

interface MemoryListsProps {
  facts: Fact[];
  shortTerm: MemoryChunk[];
  episodic: MemoryChunk[];
  semantic: MemoryChunk[];
  conflicts: ConflictItem[];
}

export function MemoryLists({ facts, shortTerm, episodic, semantic, conflicts }: MemoryListsProps) {
  const [activeTab, setActiveTab] = useState<"facts" | "memories" | "conflicts">("facts");

  return (
    <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-6">
      {/* Tab select row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-4 gap-4">
        <div>
          <h3 className="font-sans font-semibold text-base text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            Storage &amp; Cognitive Directories
          </h3>
          <p className="text-xs text-slate-400">
            Audit raw semantic memories, discovered facts ledger, and contradiction conflicts logs
          </p>
        </div>

        <div className="flex bg-[#161b22] border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("facts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTab === "facts"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Facts Ledger ({facts.length})
          </button>
          
          <button
            onClick={() => setActiveTab("memories")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTab === "memories"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Memory Pools ({shortTerm.length + episodic.length + semantic.length})
          </button>

          <button
            onClick={() => setActiveTab("conflicts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all relative ${
              activeTab === "conflicts"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Conflicts Log ({conflicts.length})
            {conflicts.some(c => !c.resolved) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="min-h-[300px]">
        {activeTab === "facts" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Extracted Groundwork Propositions (Fact ledger)
              </span>
              <span className="text-slate-400 text-xs font-mono">
                Average confidence: {(facts.reduce((sum, f) => sum + f.confidence, 0) / (facts.length || 1) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161b22]/70 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="p-3">Subject</th>
                    <th className="p-3">Predicate</th>
                    <th className="p-3">Object assertion</th>
                    <th className="p-3 text-center">Confidence</th>
                    <th className="p-3 text-center">Hits</th>
                    <th className="p-3">Source Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {facts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                        [No factual propositions learned yet]
                      </td>
                    </tr>
                  ) : (
                    facts.map((fact, i) => (
                      <tr key={fact.id || i} className="hover:bg-slate-905 hover:bg-slate-900/30 transition-colors">
                        <td className="p-3 font-semibold text-emerald-400">{fact.subject}</td>
                        <td className="p-3 text-slate-400 italic font-medium">{fact.predicate}</td>
                        <td className="p-3 text-slate-200">{fact.object}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            fact.confidence > 0.8 
                              ? "bg-emerald-500/10 text-emerald-400" 
                              : fact.confidence > 0.5 
                                ? "bg-amber-500/10 text-amber-400" 
                                : "bg-red-500/10 text-red-400"
                          }`}>
                            {(fact.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-3 text-center text-slate-400">{fact.sourceCount}x</td>
                        <td className="p-3 text-slate-400 truncate max-w-[140px]" title={fact.rawSource}>
                          {fact.context}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "memories" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Short-Term Attention */}
            <div className="bg-[#121620]/30 border border-slate-850 border-slate-800/70 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                Short-Term Attention (Rolling)
              </span>
              <p className="text-[10px] text-slate-500 leading-tight">
                Current sliding attention window. Oldest items are compressed and archived.
              </p>
              
              <div className="space-y-2 h-[260px] overflow-y-auto pr-1 styled-scrollbar">
                {shortTerm.length === 0 ? (
                  <p className="text-slate-500 italic text-[11px] text-center pt-10">[Attention empty]</p>
                ) : (
                  shortTerm.map((chunk, i) => (
                    <div key={chunk.id || i} className="bg-slate-950 p-2.5 rounded border border-slate-900 border-l-2 border-l-emerald-400">
                      <p className="font-sans text-[11px] text-slate-300 line-clamp-3">{chunk.content}</p>
                      <span className="text-[9px] font-mono text-slate-500 mt-1 block">
                        {new Date(chunk.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Episodic Memories */}
            <div className="bg-[#121620]/30 border border-slate-850 border-slate-800/70 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-widest block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Episodic Store (Experiences)
              </span>
              <p className="text-[10px] text-slate-500 leading-tight">
                Permanent records of conversations and conceptual loops, decaying dynamically.
              </p>

              <div className="space-y-2 h-[260px] overflow-y-auto pr-1 styled-scrollbar">
                {episodic.length === 0 ? (
                  <p className="text-slate-500 italic text-[11px] text-center pt-10">[Store empty]</p>
                ) : (
                  episodic.map((chunk, i) => (
                    <div key={chunk.id || i} className="bg-slate-950 p-2.5 rounded border border-slate-900 border-l-2 border-l-sky-400">
                      <p className="font-sans text-[11px] text-slate-300 line-clamp-3">{chunk.content}</p>
                      <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1.5">
                        <span>IMPORTANCE: {(chunk.importance * 100).toFixed(0)}%</span>
                        <span>{new Date(chunk.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Semantic General belief */}
            <div className="bg-[#121620]/30 border border-slate-850 border-slate-800/70 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest block flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Semantic Beliefs (Heuristics)
              </span>
              <p className="text-[10px] text-slate-500 leading-tight">
                Reinforced global facts abstracts which summarize multiple episodic patterns.
              </p>

              <div className="space-y-2 h-[260px] overflow-y-auto pr-1 styled-scrollbar">
                {semantic.length === 0 ? (
                  <p className="text-slate-500 italic text-[11px] text-center pt-10">[No beliefs consolidated]</p>
                ) : (
                  semantic.map((chunk, i) => (
                    <div key={chunk.id || i} className="bg-slate-950 p-2.5 rounded border border-slate-900 border-l-2 border-l-amber-500">
                      <p className="font-sans text-[11px] text-slate-300 leading-snug">{chunk.content}</p>
                      <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-2">
                        <span>CONFIRMATION: {chunk.confidence.toFixed(2)}</span>
                        <span>{chunk.concepts.slice(0, 2).join(", ")}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "conflicts" && (
          <div className="space-y-4">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
              Auditorium of Factual Contradictions (Conflicts Ledger)
            </span>

            {conflicts.length === 0 ? (
              <div className="text-center py-12 border border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 italic text-xs font-mono">
                No factual contradictions or discrepancies captured during runtime. System remains completely coherent.
              </div>
            ) : (
              <div className="space-y-3">
                {conflicts.map((conflict, i) => (
                  <div key={i} className="bg-[#161b22]/50 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Discrepancy #{i + 1}: Subject [{conflict.existing.subject}] predicate [{conflict.existing.predicate}]
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                        conflict.resolved ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {conflict.resolved ? "RESOLVED" : "PENDING UNIFICATION"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Existing */}
                      <div className={`p-2.5 rounded-lg border text-xs font-mono ${
                        conflict.resolved && conflict.winnerId === conflict.existing.id
                          ? "bg-emerald-950/15 border-emerald-500/35 text-emerald-300"
                          : "bg-slate-950 border-slate-900 text-slate-400"
                      }`}>
                        <span className="text-[8px] font-semibold block text-slate-500 uppercase mb-1">EXISTING Assertion</span>
                        <p>{conflict.existing.subject} {conflict.existing.predicate} {conflict.existing.object}</p>
                        <span className="text-[9px] mt-1.5 block text-slate-500 italic">Confidence: {(conflict.existing.confidence * 100).toFixed(0)}%</span>
                      </div>

                      {/* Incoming */}
                      <div className={`p-2.5 rounded-lg border text-xs font-mono ${
                        conflict.resolved && conflict.winnerId === conflict.incoming.id
                          ? "bg-emerald-950/15 border-emerald-500/35 text-emerald-300"
                          : "bg-slate-950 border-slate-900 text-slate-400"
                      }`}>
                        <span className="text-[8px] font-semibold block text-slate-500 uppercase mb-1">INCOMING assertions</span>
                        <p>{conflict.incoming.subject} {conflict.incoming.predicate} {conflict.incoming.object}</p>
                        <span className="text-[9px] mt-1.5 block text-slate-500 italic">Confidence: {(conflict.incoming.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
