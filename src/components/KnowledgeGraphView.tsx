/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Node, Edge, VECTOR_DIMENSIONS } from "../engine/types.ts";
import { Brain, Compass, Info, Zap } from "lucide-react";

interface GraphNode extends Node {
  x: number;
  y: number;
}

interface KnowledgeGraphViewProps {
  nodes: GraphNode[];
  edges: Edge[];
  onNodeClick?: (node: GraphNode) => void;
}

export function KnowledgeGraphView({ nodes, edges, onNodeClick }: KnowledgeGraphViewProps) {
  const [viewMode, setViewMode] = useState<"projection" | "network">("projection");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // SVG Size parameters
  const svgWidth = 600;
  const svgHeight = 400;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;

  // Compute positions of nodes
  const processedNodes = nodes.map((node, index) => {
    if (viewMode === "projection") {
      // Scale coordinates from [-180, 180] to SVG canvas relative to center
      const scale = 1.0;
      return {
        ...node,
        cx: centerX + node.x * scale,
        cy: centerY - node.y * scale // Invert Y for Cartesian coordinates
      };
    } else {
      // Distribute in concentric network ring sizes based on importance
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = 130 + (1 - node.importance) * 60;
      return {
        ...node,
        cx: centerX + Math.cos(angle) * radius,
        cy: centerY + Math.sin(angle) * radius
      };
    }
  });

  const handleSelectNode = (node: GraphNode) => {
    setSelectedNode(node);
    if (onNodeClick) onNodeClick(node);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Visual Canvas Area */}
      <div className="lg:col-span-2 bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden shadow-2xl shadow-black/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 z-10 relative">
          <div>
            <h3 className="font-sans font-semibold text-base text-slate-100 flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              Cellular Brain Visualizer
            </h3>
            <p className="text-xs text-slate-400">
              Interactive structural map of concept nodes inside the knowledge core
            </p>
          </div>
          
          <div className="flex bg-[#161b22] border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("projection")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === "projection"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Sentelum Space Projection
            </button>
            <button
              onClick={() => setViewMode("network")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === "network"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Network Ring Topology
            </button>
          </div>
        </div>

        {/* Dynamic Coordinates Box */}
        {viewMode === "projection" && (
          <div className="absolute top-20 left-6 bg-[#161b22]/90 border border-slate-800/50 p-2.5 rounded-xl z-10 text-[10px] font-mono text-slate-400 backdrop-blur-md pointer-events-none">
            <p className="text-slate-300 font-bold mb-1">AXIS ALIGNMENT</p>
            <p>X-Axis: Hardware / Mechanical Transport</p>
            <p>Y-Axis: Abstract / Digital / Cognitive</p>
          </div>
        )}

        {/* SVG Drawing Layer */}
        <div className="bg-[#090d14] rounded-xl border border-slate-900 overflow-hidden flex items-center justify-center p-2 relative h-[400px]">
          {processedNodes.length === 0 ? (
            <div className="text-slate-500 text-xs text-center py-20 font-mono">
              [No concept nodes loaded in Graph]
            </div>
          ) : (
            <svg 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              className="w-full h-full select-none"
              style={{ maxHeight: "380px" }}
            >
              {/* Grid Background Lines (Projection space) */}
              {viewMode === "projection" && (
                <>
                  <line x1={centerX} y1={20} x2={centerX} y2={svgHeight - 20} stroke="#1e293b" strokeWidth={1} strokeDasharray="3 3" />
                  <line x1={20} y1={centerY} x2={svgWidth - 20} y2={centerY} stroke="#1e293b" strokeWidth={1} strokeDasharray="3 3" />
                  
                  {/* Axis Origin Marker */}
                  <circle cx={centerX} cy={centerY} r={3} fill="#475569" opacity={0.5} />
                </>
              )}

              {/* Edge Connection Lines */}
              {edges.map((edge, i) => {
                const sourceNode = processedNodes.find(n => n.id === edge.source);
                const targetNode = processedNodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const opacity = 0.3 + edge.weight * 0.4;
                const strokeWidth = 1 + edge.weight * 2.5;

                return (
                  <g key={`edge-${i}`}>
                    <line
                      x1={sourceNode.cx}
                      y1={sourceNode.cy}
                      x2={targetNode.cx}
                      y2={targetNode.cy}
                      stroke={edge.type === "is_a" ? "#34d399" : edge.type === "created_by" ? "#60a5fa" : "#f59e0b"}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                    />
                    {/* Middle label for predicate on hover */}
                    <circle 
                      cx={(sourceNode.cx + targetNode.cx) / 2} 
                      cy={(sourceNode.cy + targetNode.cy) / 2} 
                      r={4}
                      fill="#1e293b"
                      stroke="#475569"
                      strokeWidth={0.5}
                    />
                  </g>
                );
              })}

              {/* Node Circles */}
              {processedNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const nodeColor = node.importance > 0.4 ? "fill-emerald-400 stroke-emerald-300" : "fill-slate-400 stroke-slate-300";

                return (
                  <g 
                    key={node.id} 
                    transform={`translate(${node.cx}, ${node.cy})`}
                    className="cursor-pointer group"
                    onClick={() => handleSelectNode(node)}
                  >
                    {/* Glow effect for selected node */}
                    {isSelected && (
                      <circle r={14} className="fill-emerald-500/20 stroke-emerald-400 animate-pulse" strokeWidth={1.5} />
                    )}

                    {/* Interactive hover circle */}
                    <circle r={16} fill="transparent" className="group-hover:fill-slate-500/10 transition-colors" />

                    {/* Central Node Circle */}
                    <circle 
                      r={6 + node.importance * 6} 
                      className={`${nodeColor} transition-all duration-300 ${isSelected ? "r-[14px]" : ""}`}
                      strokeWidth={1.5}
                    />

                    {/* Text Label */}
                    <rect
                      x={-40}
                      y={-22 - node.importance * 4}
                      width={80}
                      height={14}
                      rx={3}
                      fill="#0d1117"
                      opacity={0.8}
                      className="hidden group-hover:block pointer-events-none"
                    />
                    
                    <text
                      y={18 + node.importance * 4}
                      textAnchor="middle"
                      className="font-mono text-[9px] font-bold fill-slate-300 group-hover:fill-emerald-300 transition-colors select-none"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Selected Node Details & Vectors */}
      <div className="bg-[#0c1017]/85 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
        {selectedNode ? (
          <div className="flex-1 flex flex-col">
            <div className="border-b border-slate-800 pb-4 mb-4">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 uppercase">
                Concept Node
              </span>
              <h4 className="font-sans font-bold text-lg text-slate-100 mt-2 flex items-center gap-2">
                {selectedNode.label}
              </h4>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                KEY: {selectedNode.id} | TOPIC: {selectedNode.metadata.topic || "general"}
              </p>
            </div>

            {/* Node metadata specifications */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
              <div className="bg-[#161b22] p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[9px] text-slate-500 block">COGNITIVE IMPORTANCE</span>
                <span className="text-emerald-400 font-bold block mt-0.5">
                  {(selectedNode.importance * 100).toFixed(1)}%
                </span>
                <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${selectedNode.importance * 100}%` }}></div>
                </div>
              </div>

              <div className="bg-[#161b22] p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[9px] text-slate-500 block">CALL FREQUENCY</span>
                <span className="text-sky-400 font-bold block mt-0.5">
                  {selectedNode.usageFrequency}x hits
                </span>
              </div>
            </div>

            {/* Synonyms & aliases */}
            {(selectedNode.metadata.synonyms && selectedNode.metadata.synonyms.length > 0) && (
              <div className="mb-4">
                <span className="text-[10px] font-mono text-slate-500 block mb-2">LOCAL SYNONYMS</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.metadata.synonyms.map((s: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-800/60 border border-slate-700/60 rounded text-[10px] font-mono text-slate-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 16-D Semantic Vector Bars */}
            <div className="flex-1 overflow-y-auto max-h-[170px] pr-1 styled-scrollbar">
              <span className="text-[10px] font-mono text-slate-500 block mb-2.5 uppercase tracking-wide flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Sentelum 16-D Semantic Vector
              </span>

              <div className="space-y-2 text-[10px] font-mono">
                {VECTOR_DIMENSIONS.map((dim, idx) => {
                  const val = selectedNode.vector[idx] || 0.0;
                  return (
                    <div key={dim} className="flex items-center gap-2">
                      <span className="w-20 text-slate-400 text-left truncate">{dim}</span>
                      <div className="flex-1 bg-slate-900/90 h-2 rounded-full overflow-hidden border border-slate-800/35 relative">
                        <div 
                          className="bg-emerald-400 h-full rounded-full" 
                          style={{ width: `${val * 100}%` }}
                        ></div>
                      </div>
                      <span className="w-8 text-right font-bold text-slate-300">
                        {val.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800/60 rounded-xl bg-slate-900/10">
            <Info className="w-8 h-8 text-slate-500 mb-2" />
            <h4 className="font-sans font-semibold text-slate-300 text-sm">No Concept Selected</h4>
            <p className="text-xs text-slate-500 max-w-[200px] mt-1">
              Click on any floating node in the visualizer to inspect its vector states and memory metrics
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
