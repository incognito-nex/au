/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
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

export function APIConsole() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [execMode, setExecMode] = useState<"waterfall" | "multithread">("multithread");
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency?: number; error?: string }>>({});
  
  // Edit key states
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [keysInput, setKeysInput] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

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

        {/* Informational Guidance Sidebar */}
        <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="border-b border-slate-800/80 pb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400" />
            <h4 className="font-sans font-bold text-sm text-slate-200">
              Architecture Overview
            </h4>
          </div>

          <div className="space-y-3.5 text-xs text-slate-400 leading-normal font-sans">
            <p>
              Stellight supports **Multi-threaded Parallel Raced** prompts. When multiple models are enabled, it triggers requests at the same time and races them inside Node.js.
            </p>

            <div className="bg-[#12161f] p-3 rounded-xl border border-slate-800/60 font-mono space-y-2 text-[11px]">
              <span className="text-emerald-400 font-bold block flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                CONCURRENCY PROTECTION
              </span>
              <p className="text-slate-500 text-[10px] leading-tight">
                If any single model hits a rate-limit, exhaustion, or times out, Stellight automatically ignores the failure and returns the fastest complete answer from another channel.
              </p>
            </div>

            <div className="bg-[#12161f] p-3 rounded-xl border border-slate-800/60 font-mono space-y-2 text-[11px]">
              <span className="text-sky-400 font-bold block flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                KEY ROTATION POOLS
              </span>
              <p className="text-slate-500 text-[10px] leading-tight">
                Add multiple API keys separated by commas. Stellight will cycle to the next key on any failure, ensuring near-infinite tier uptime!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
