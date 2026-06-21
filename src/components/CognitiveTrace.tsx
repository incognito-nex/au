/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ReasoningTrace, VECTOR_DIMENSIONS } from "../engine/types.ts";
import { Check, ChevronDown, ChevronRight, Cpu, Eye, Hourglass, HelpCircle, AlertCircle, Quote } from "lucide-react";

interface CognitiveTraceProps {
  trace: ReasoningTrace | null;
}

export function CognitiveTrace({ trace }: CognitiveTraceProps) {
  const [expandedStepIdx, setExpandedStepIdx] = useState<number | null>(0);
  const [displayedResponse, setDisplayedResponse] = useState("");

  const responseText = trace?.response || "";

  React.useEffect(() => {
    if (!responseText) {
      setDisplayedResponse("");
      return;
    }

    const words = responseText.split(/(\s+)/); // keep whitespace matching
    let currentIdx = 0;
    setDisplayedResponse("");

    const interval = setInterval(() => {
      if (currentIdx < words.length) {
        setDisplayedResponse((prev) => {
          return prev + (words[currentIdx] || "");
        });
        currentIdx++;
      } else {
        clearInterval(interval);
      }
    }, 15); // Naturally smooth fast typing pace

    return () => clearInterval(interval);
  }, [responseText]);

  if (!trace) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 bg-[#0c1017]/85 border border-[#1e293b] rounded-2xl shadow-2xl">
        <Hourglass className="w-10 h-10 text-slate-500 animate-spin mb-4" />
        <h3 className="font-sans font-semibold text-slate-300 text-base">Awaiting Cognitive Input</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5">
          Send a query to the Stellight Sentelum Engine to witness the multi-layer cognitive reasoning trace in real-time
        </p>
      </div>
    );
  }

  const { steps, normalized, confidence, response } = trace;

  const toggleStep = (idx: number) => {
    if (expandedStepIdx === idx) {
      setExpandedStepIdx(null);
    } else {
      setExpandedStepIdx(idx);
    }
  };

  return (
    <div className="space-y-6">
      {/* Trace Title & Metric Header */}
      <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-sans font-bold text-base text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            Cognitive Reasoning Trace
          </h3>
          <p className="text-xs text-slate-400">
            Real-time telemetry of internal stages for query: &quot;{trace.input}&quot;
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#161b22] border border-slate-800 p-2.5 rounded-xl text-center text-xs font-mono min-w-[120px]">
            <span className="text-[9px] text-slate-500 block">COMPOSITE CONFIDENCE</span>
            <span className="text-emerald-400 font-extrabold mt-0.5 block text-sm">
              {(confidence * 100).toFixed(1)}%
            </span>
          </div>
          
          <div className="bg-[#161b22] border border-slate-800 p-2.5 rounded-xl text-center text-xs font-mono min-w-[120px]">
            <span className="text-[9px] text-slate-500 block">MITIGATION GATEWAY</span>
            <span className="text-sky-400 font-extrabold mt-0.5 block text-[10px] uppercase">
              Hallucination Safe
            </span>
          </div>
        </div>
      </div>

      {/* Thinking Stepper Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-3">
          {steps.map((step, idx) => {
            const isExpanded = expandedStepIdx === idx;
            return (
              <div 
                key={idx}
                className={`bg-[#0c1017]/85 border rounded-xl overflow-hidden transition-all duration-300 ${
                  isExpanded ? "border-emerald-500/30 shadow-emerald-500/5 shadow-md" : "border-slate-800/85 hover:border-slate-700/80"
                }`}
              >
                {/* Stepper Header */}
                <div 
                  onClick={() => toggleStep(idx)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold ${
                      isExpanded ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-805 bg-slate-900 text-slate-400"
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-sans font-semibold text-xs text-slate-200">
                        {step.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-500">
                      {isExpanded ? "ACTIVE" : "EXPAND"}
                    </span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Stepper Content Panel */}
                {isExpanded && (
                  <div className="bg-[#090c11] border-t border-slate-900 p-4 font-mono text-xs">
                    {/* Render matching views based on steps */}
                    {idx === 0 && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="bg-[#12161f] p-2 rounded-lg border border-slate-800/60">
                            <span className="text-[9px] text-slate-500 block">INTENT DETECTED</span>
                            <span className="text-slate-300 font-bold block mt-0.5 uppercase">{normalized.intent}</span>
                          </div>
                          <div className="bg-[#12161f] p-2 rounded-lg border border-slate-800/60">
                            <span className="text-[9px] text-slate-500 block">PRIMARY CONCEPT</span>
                            <span className="text-emerald-400 font-bold block mt-0.5">{normalized.primaryConcept}</span>
                          </div>
                          <div className="bg-[#12161f] p-2 rounded-lg border border-slate-800/60 col-span-2 md:col-span-1">
                            <span className="text-[9px] text-slate-500 block">COGNITIVE DOMAIN</span>
                            <span className="text-sky-400 font-bold block mt-0.5 capitalize">{normalized.topic}</span>
                          </div>
                        </div>

                        {/* Entities / Synonyms */}
                        <div className="flex flex-col sm:flex-row gap-4 border-t border-slate-800/40 pt-3">
                          <div className="flex-1">
                            <span className="text-[9px] text-slate-500 block mb-1">ENTITIES IDENTIFIED</span>
                            <div className="flex flex-wrap gap-1">
                              {normalized.entities.length > 0 ? (
                                normalized.entities.map((e, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-300">{e}</span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500">[Nil]</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <span className="text-[9px] text-slate-500 block mb-1">CONCEPT SYNONYMS</span>
                            <div className="flex flex-wrap gap-1">
                              {normalized.synonyms.length > 0 ? (
                                normalized.synonyms.map((s, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-300">{s}</span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500">[Nil]</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Query Estimated Vector */}
                        <div className="border-t border-slate-800/40 pt-3">
                          <span className="text-[9px] text-slate-500 block mb-2">EXTRACTED CONCEPT VELOCITY VECTOR</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px]">
                            {VECTOR_DIMENSIONS.slice(0, 12).map((dim, index) => {
                              const weight = normalized.estimatedVector[index] || 0;
                              return (
                                <div key={dim} className="flex justify-between items-center bg-slate-950 p-1 px-2 rounded border border-slate-900/60">
                                  <span className="text-slate-400 truncate w-14 text-left">{dim}</span>
                                  <span className={`font-bold ${weight > 0.4 ? "text-emerald-400" : "text-slate-500"}`}>{weight.toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {idx === 1 && (
                      <div className="space-y-3">
                        <span className="text-[9px] text-slate-500 block mb-2">CUSTOM SENTELUM SCORE RANKING WEIGHTS</span>
                        <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                          {step.details.scoredRankings?.map((rank: any, i: number) => (
                            <div key={rank.id} className="bg-[#12161f] p-2.5 rounded-lg border border-slate-800/60">
                              <div className="flex justify-between items-center sm:grid-cols-2 gap-2 mb-1.5">
                                <span className="font-bold text-slate-200">{rank.label}</span>
                                <span className="text-emerald-400 font-bold">{(rank.compositeScore * 100).toFixed(1)}% match</span>
                              </div>
                              {/* Stacked Breakdown coefficient */}
                              <div className="text-[9px] text-slate-400 grid grid-cols-3 sm:grid-cols-5 gap-1.5 pt-1.5 border-t border-slate-800/35">
                                <div>Sem: {(rank.breakdown.semantic * 100).toFixed(0)}%</div>
                                <div>Ctx: {(rank.breakdown.context * 100).toFixed(0)}%</div>
                                <div>Rel: {(rank.breakdown.relationship * 100).toFixed(0)}%</div>
                                <div>Cfd: {(rank.breakdown.confidence * 100).toFixed(0)}%</div>
                                <div>Rec: {(rank.breakdown.recency * 100).toFixed(0)}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {idx === 2 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-slate-400 border-b border-slate-800/50 pb-1.5">
                          <span>Verified Concepts: {step.details.retrievedConcepts?.join(", ") || "[None]"}</span>
                          <span>Facts found: {step.details.retrievedFactsCount}</span>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          {step.details.matchingFacts?.length > 0 ? (
                            step.details.matchingFacts.map((fact: string, idx: number) => (
                              <div key={idx} className="bg-slate-950 p-1.5 rounded border border-slate-900 stroke-slate-800 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span className="text-slate-300 font-mono text-[10px]">{fact}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-500 text-[10px] text-center italic py-2">
                              No firm facts matching these coordinates found in long-term memory. System will construct hypotheticals.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {idx === 6 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] mb-2">
                          <Eye className="w-3.5 h-3.5" />
                          Newly Extracted assertions: {step.details.extractedFactsCount}
                        </div>
                        {step.details.newFacts?.length > 0 ? (
                          step.details.newFacts.map((fact: string, i: number) => (
                            <div key={i} className="p-2 bg-emerald-950/15 border border-emerald-900/35 text-emerald-300 rounded font-mono text-[10px] flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                LEARNED: {fact}
                              </span>
                              <span className="px-1 bg-emerald-500/10 rounded font-bold">Confidence +0.8</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-500 italic text-[10px] text-center">
                            No brand new factual loops extracted during this conversation turn.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Generic detail printout if no custom layout exists */}
                    {idx !== 0 && idx !== 1 && idx !== 2 && idx !== 6 && (
                      <pre className="p-3 bg-slate-950 rounded text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-[170px]">
                        {JSON.stringify(step.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Generated Answer Display */}
        <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="border-b border-secondary pb-3 flex items-center gap-2">
            <span className="p-1 px-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
              <Quote className="w-4 h-4" />
            </span>
            <div>
              <h4 className="font-sans font-bold text-sm text-slate-100">
                Cognitive Response Output
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Stellight response synthesized with local long-term beliefs
              </p>
            </div>
          </div>

          <div className="font-sans text-sm text-slate-300 leading-relaxed bg-[#090d14]/80 p-4 border border-slate-900 rounded-xl max-h-[300px] overflow-y-auto styled-scrollbar h-auto select-text">
            {displayedResponse ? (
              <p className="whitespace-pre-wrap">
                {displayedResponse}
                {displayedResponse.length < (response || "").length && (
                  <span className="inline-block w-1.5 h-4 ml-1.5 bg-emerald-400 animate-pulse align-middle" />
                )}
              </p>
            ) : (
              <span className="text-slate-500 italic font-mono text-xs">
                Waiting for synthesis pipeline output...
              </span>
            )}
          </div>

          <div className="bg-[#12161f] border border-slate-800 p-3 rounded-xl flex items-start gap-2.5 text-[11px] font-mono text-slate-400">
            <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              This response is strictly mapped by local confidence variables inside the knowledge graph. Facts have source citations compiled to avoid LLM hallucination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
