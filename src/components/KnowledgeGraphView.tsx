/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Node, Edge, VECTOR_DIMENSIONS } from "../engine/types.ts";
import { Brain, Compass, Info, Zap, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartClickCoords, setDragStartClickCoords] = useState({ x: 0, y: 0 });

  // Reset selected node when props change
  useEffect(() => {
    if (nodes.length > 0 && selectedNode) {
      const fresh = nodes.find(n => n.id === selectedNode.id);
      if (fresh) {
        setSelectedNode(fresh);
      }
    }
  }, [nodes]);

  // SVG Size settings
  const svgWidth = 600;
  const svgHeight = 400;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;

  // Process node alignments based on view modes
  const processedNodes = nodes.map((node, index) => {
    if (viewMode === "projection") {
      // Coordinate translation with auto-adaptive magnification
      const scale = 1.05;
      return {
        ...node,
        cx: centerX + node.x * scale,
        cy: centerY - node.y * scale
      };
    } else {
      // Symmetric dynamic ring distribution
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = 135 + (1 - node.importance) * 55;
      return {
        ...node,
        cx: centerX + Math.cos(angle) * radius,
        cy: centerY + Math.sin(angle) * radius
      };
    }
  });

  // Pan and Zoom Event Hanlders
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
    setDragStartClickCoords({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomIntensity = 0.04;
    const delta = -e.deltaY;
    const factor = delta > 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
    const newZoom = Math.max(0.2, Math.min(4.0, zoom * factor));
    setZoom(newZoom);
  };

  const handleZoomIn = () => setZoom(z => Math.min(4.0, z + 0.15));
  const handleZoomOut = () => setZoom(z => Math.max(0.2, z - 0.15));
  const handleResetCamera = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
  };

  const handleSelectNode = (node: GraphNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const dx = e.clientX - dragStartClickCoords.x;
    const dy = e.clientY - dragStartClickCoords.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Ignore click selection if mouse moved (meaning they meant to drag pan)
    if (distance < 5) {
      setSelectedNode(node);
      if (onNodeClick) onNodeClick(node);
    }
  };

  // Compute subnets for hovering highlighting
  const activeFocusId = hoveredNodeId || selectedNode?.id;
  const adjacentNodeIds = new Set<string>();

  if (activeFocusId) {
    adjacentNodeIds.add(activeFocusId);
    edges.forEach(edge => {
      if (edge.source === activeFocusId) adjacentNodeIds.add(edge.target);
      if (edge.target === activeFocusId) adjacentNodeIds.add(edge.source);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
      {/* Visual Canvas Area */}
      <div className="lg:col-span-2 bg-theme-panel border border-theme-border rounded-2xl p-5 relative overflow-hidden shadow-2xl flex flex-col h-[500px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 z-10 relative">
          <div>
            <h3 className="font-sans font-bold text-theme-text-primary flex items-center gap-2 text-sm uppercase tracking-wider">
              <Brain className="w-5 h-5 text-emerald-400" />
              Dynamic Synaptic Brain Model
            </h3>
            <p className="text-xs text-theme-text-secondary">
              Interactive structural projection of Starlight memories. Drag to pan, scroll to zoom nodes.
            </p>
          </div>
          
          <div className="flex bg-[#161b22] border border-slate-800/80 p-0.5 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setViewMode("projection")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "projection"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "text-theme-text-secondary hover:text-theme-text-primary"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Starlight Core Projection
            </button>
            <button
              onClick={() => setViewMode("network")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "network"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Network Rings
            </button>
          </div>
        </div>

        {/* Floating Zoom & camera controls panel */}
        <div className="absolute bottom-10 right-10 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl z-20 flex gap-1 shadow-xl backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="p-1 px-2.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 font-bold text-xs text-slate-300 active:scale-95 transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 px-2.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 font-bold text-xs text-slate-300 active:scale-95 transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetCamera}
            className="p-1 px-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 font-bold text-xs text-slate-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            title="Reset Viewport"
          >
            <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wide">RESET</span>
          </button>
        </div>

        {/* Dynamic Axis Alignement Labels */}
        {viewMode === "projection" && (
          <div className="absolute top-24 left-10 bg-[#161b22]/95 border border-slate-800/80 p-2.5 rounded-xl z-10 text-[9px] font-mono text-slate-400 backdrop-blur-md pointer-events-none space-y-0.5">
            <p className="text-emerald-400 font-extrabold tracking-wider uppercase mb-1 border-b border-slate-800 pb-1">AXIS CORRELATIONS</p>
            <p>X-Axis: Hardware / Mechanical Transport / Systems</p>
            <p>Y-Axis: Abstract Theory / Cognitive Logic / Coding</p>
          </div>
        )}

        {/* SVG Drawing Layer with Panning Handlers */}
        <div className="bg-[#07090e] rounded-xl border border-slate-900 overflow-hidden flex items-center justify-center p-2 relative h-[400px] cursor-grab active:cursor-grabbing">
          {processedNodes.length === 0 ? (
            <div className="text-slate-500 text-xs text-center py-20 font-mono">
              [No concept nodes loaded in Graph]
            </div>
          ) : (
            <svg 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              className="w-full h-full select-none"
              style={{ maxHeight: "380px" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              {/* Transform Group applying global Camera Matrix */}
              <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                
                {/* Grid Background Indicator System */}
                {viewMode === "projection" && (
                  <g opacity={0.3}>
                    <line x1={centerX} y1={-200} x2={centerX} y2={svgHeight + 200} stroke="#1e293b" strokeWidth={1} strokeDasharray="3 3" />
                    <line x1={-200} y1={centerY} x2={svgWidth + 200} y2={centerY} stroke="#1e293b" strokeWidth={1} strokeDasharray="3 3" />
                    
                    {/* Ring helper guidelines */}
                    <circle cx={centerX} cy={centerY} r={100} stroke="#111827" fill="none" strokeWidth={1} />
                    <circle cx={centerX} cy={centerY} r={200} stroke="#111827" fill="none" strokeWidth={1} />
                  </g>
                )}

                {/* Ring topology grids */}
                {viewMode === "network" && (
                  <g opacity={0.2}>
                    <circle cx={centerX} cy={centerY} r={135} stroke="#334155" fill="none" strokeWidth={1} strokeDasharray="2 3" />
                    <circle cx={centerX} cy={centerY} r={190} stroke="#334155" fill="none" strokeWidth={1} strokeDasharray="2 3" />
                  </g>
                )}

                {/* Edge Connections */}
                {edges.map((edge, i) => {
                  const sourceNode = processedNodes.find(n => n.id === edge.source);
                  const targetNode = processedNodes.find(n => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  // High-fidelity Highlight State logic
                  const isHighlighted = activeFocusId && (edge.source === activeFocusId || edge.target === activeFocusId);
                  const isDimmed = activeFocusId && !isHighlighted;

                  let strokeColor = "#475569";
                  if (edge.type === "is_a") strokeColor = "#10b981"; // Emerald
                  else if (edge.type === "created_by") strokeColor = "#3b82f6"; // Blue
                  else if (edge.type === "causes") strokeColor = "#ef4444"; // Red
                  else if (edge.type === "requires") strokeColor = "#f59e0b"; // Orange
                  else if (edge.type === "similar_to") strokeColor = "#8b5cf6"; // Purple

                  const strokeWidth = isHighlighted ? 2.5 : (1.0 + edge.weight * 1.5);
                  const opacity = isDimmed ? 0.05 : (isHighlighted ? 0.9 : (0.2 + edge.weight * 0.4));

                  return (
                    <g key={`edge-${i}`}>
                      <line
                        x1={sourceNode.cx}
                        y1={sourceNode.cy}
                        x2={targetNode.cx}
                        y2={targetNode.cy}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                        className="transition-all duration-300"
                        strokeDasharray={isHighlighted ? "4 2" : undefined}
                      />
                      {/* Interactive Predicate Label Anchor */}
                      {!isDimmed && (
                        <circle 
                          cx={(sourceNode.cx + targetNode.cx) / 2} 
                          cy={(sourceNode.cy + targetNode.cy) / 2} 
                          r={3.5}
                          fill="#090d14"
                          stroke={isHighlighted ? strokeColor : "#334155"}
                          strokeWidth={isHighlighted ? 1.5 : 0.8}
                          opacity={isHighlighted ? 0.95 : 0.65}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Node Circles */}
                {processedNodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  const isDimmed = activeFocusId && !adjacentNodeIds.has(node.id);
                  const importanceRadius = 5.5 + node.importance * 6;

                  let nodeColor = "fill-slate-450 stroke-slate-300";
                  if (node.importance > 0.55) {
                    nodeColor = "fill-emerald-500 stroke-emerald-300";
                  } else if (node.importance > 0.3) {
                    nodeColor = "fill-teal-500 stroke-teal-300";
                  }

                  const opacity = isDimmed ? 0.25 : 1.0;

                  return (
                    <g 
                      key={node.id} 
                      transform={`translate(${node.cx}, ${node.cy})`}
                      className="cursor-pointer"
                      onClick={(e) => handleSelectNode(node, e)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      opacity={opacity}
                    >
                      {/* Selected pulsing halo */}
                      {isSelected && (
                        <circle r={importanceRadius + 9} className="fill-emerald-500/10 stroke-emerald-400 animate-pulse" strokeWidth={1} />
                      )}

                      {/* Hover ring */}
                      {isHovered && (
                        <circle r={importanceRadius + 6} className="fill-slate-500/10 stroke-slate-400/50" strokeWidth={0.8} />
                      )}

                      {/* central vector node body */}
                      <circle 
                        r={importanceRadius} 
                        className={`${nodeColor} transition-all duration-300`}
                        strokeWidth={isHovered || isSelected ? 2.5 : 1.2}
                      />

                      {/* Node Text Label Card */}
                      <rect
                        x={-42}
                        y={-24 - importanceRadius}
                        width={84}
                        height={13}
                        rx={3.5}
                        fill="#05070a"
                        stroke="#1e293b"
                        strokeWidth={0.5}
                        opacity={0.85}
                        className={isHovered || isSelected ? "block" : "hidden"}
                      />
                      
                      <text
                        y={importanceRadius + 14}
                        textAnchor="middle"
                        className={`font-sans text-[9px] font-bold tracking-tight select-none ${
                          isSelected 
                            ? "fill-emerald-400 font-extrabold" 
                            : (isHovered ? "fill-teal-300" : "fill-slate-300")
                        }`}
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>
      </div>

      {/* Selected Node Details & Vectors */}
      <div className="bg-theme-panel border border-theme-border rounded-2xl p-5 shadow-2xl flex flex-col justify-between h-[500px]">
        {selectedNode ? (
          <div className="flex-1 flex flex-col">
            <div className="border-b border-slate-800 pb-4 mb-4">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 uppercase tracking-wider">
                Concept Node
              </span>
              <h4 className="font-sans font-extrabold text-slate-100 text-lg mt-2 flex items-center gap-2">
                {selectedNode.label}
              </h4>
              <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
                NODE_ADDRESS: {selectedNode.id} | context: {selectedNode.metadata.topic || "general"}
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
              <div className="bg-[#161b22] p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[9px] text-slate-500 block uppercase font-bold text-[8px]">COGNITIVE EXPOSURE</span>
                <span className="text-emerald-400 font-bold block mt-0.5">
                  {(selectedNode.importance * 100).toFixed(1)}%
                </span>
                <div className="w-full bg-slate-800/80 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-emerald-450 h-full rounded-full" style={{ width: `${selectedNode.importance * 100}%` }}></div>
                </div>
              </div>

              <div className="bg-[#161b22] p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[9px] text-slate-505 block uppercase font-bold text-[8px]">CALL PATTERN HITS</span>
                <span className="text-sky-400 font-bold block mt-0.5">
                  {selectedNode.usageFrequency}x recalls
                </span>
              </div>
            </div>

            {/* Synonyms & aliases */}
            {(selectedNode.metadata.synonyms && selectedNode.metadata.synonyms.length > 0) && (
              <div className="mb-4">
                <span className="text-[9px] font-mono font-bold text-slate-500 block mb-2 uppercase">Local Alignment aliases</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.metadata.synonyms.map((s: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[9px] text-slate-350">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 16-D Semantic Vector Bars */}
            <div className="flex-1 overflow-y-auto max-h-[160px] pr-1 styled-scrollbar">
              <span className="text-[9px] font-mono font-bold text-theme-text-secondary block mb-2.5 uppercase tracking-widest flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                16-D Vector Coordination
              </span>

              <div className="space-y-2 text-[10px] font-mono">
                {VECTOR_DIMENSIONS.map((dim, idx) => {
                  const val = selectedNode.vector[idx] || 0.0;
                  return (
                    <div key={dim} className="flex items-center gap-2">
                      <span className="w-20 text-slate-450 text-left truncate uppercase tracking-tight text-[8.5px]">{dim}</span>
                      <div className="flex-1 bg-slate-950/90 h-1.5 rounded-full overflow-hidden border border-slate-900 relative">
                        <div 
                          className="bg-emerald-400 h-full rounded-full" 
                          style={{ width: `${val * 100}%` }}
                        ></div>
                      </div>
                      <span className="w-8 text-right font-extrabold text-slate-300">
                        {val.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800/80 rounded-xl bg-slate-900/10">
            <Info className="w-8 h-8 text-slate-600 mb-2" />
            <h4 className="font-sans font-bold text-slate-300 text-xs uppercase tracking-wider">No Concept Node Inspected</h4>
            <p className="text-xs text-slate-500 max-w-[210px] mt-1.5 leading-relaxed">
              Click on any floating node in the visualizer to inspect its high-dimensional vector coordinates, local context, and association histories.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
