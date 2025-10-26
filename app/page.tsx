"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Plus, Undo2, Redo2, ZoomIn, ZoomOut, Download, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Node {
  id: string
  text: string
  x: number
  y: number
  parentId: string | null
  children: string[]
  level: number
}

interface Connection {
  from: string
  to: string
}

interface NodeDimensions {
  width: number
  height: number
}

const COLORS = [
  "from-blue-400 to-blue-600",
  "from-purple-400 to-purple-600",
  "from-green-400 to-green-600",
  "from-orange-400 to-orange-600",
  "from-pink-400 to-pink-600",
]

const NODE_WIDTH = 237
const NODE_HEIGHT = 47

export default function MindMapApp() {
  const [nodes, setNodes] = useState<Record<string, Node>>({
    root: {
      id: "root",
      text: "Main Idea",
      x: 400,
      y: 300,
      parentId: null,
      children: [],
      level: 0,
    },
  })

  const [connections, setConnections] = useState<Connection[]>([])
  const [editingNode, setEditingNode] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [selectedNode, setSelectedNode] = useState<string>("root")
  const [history, setHistory] = useState<Record<string, Node>[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [isModifierHeld, setIsModifierHeld] = useState(false)

  const [nodeDimensions, setNodeDimensions] = useState<Record<string, NodeDimensions>>({})

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const nodeRefs = useRef<Record<string, HTMLDivElement>>({})

  const measureNodeDimensions = useCallback(() => {
    const newDimensions: Record<string, NodeDimensions> = {}

    Object.keys(nodes).forEach((nodeId) => {
      const nodeElement = nodeRefs.current[nodeId]
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect()
        newDimensions[nodeId] = {
          width: rect.width / zoom, // Adjust for zoom
          height: rect.height / zoom,
        }
      }
    })

    setNodeDimensions(newDimensions)
  }, [nodes, zoom])

  useEffect(() => {
    const timer = setTimeout(measureNodeDimensions, 50)
    return () => clearTimeout(timer)
  }, [measureNodeDimensions, editingNode])

  const saveToHistory = useCallback(
    (newNodes: Record<string, Node>) => {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push({ ...newNodes })
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    },
    [history, historyIndex],
  )

  const calculateLayout = useCallback(
    (nodeMap: Record<string, Node>) => {
      const updatedNodes = { ...nodeMap }

      const calculateBranchHeight = (nodeId: string): number => {
        const node = updatedNodes[nodeId]
        if (!node.children.length) return NODE_HEIGHT + 30

        const childrenHeight = node.children.reduce((total, childId) => {
          return total + calculateBranchHeight(childId)
        }, 0)

        return Math.max(NODE_HEIGHT + 30, childrenHeight)
      }

      const positionNodeAndChildren = (nodeId: string, startY: number): number => {
        const node = updatedNodes[nodeId]
        const currentY = startY

        if (node.children.length === 0) {
          updatedNodes[nodeId] = { ...node, y: currentY }
          return currentY + NODE_HEIGHT + 30
        }

        const childHeights = node.children.map((childId) => calculateBranchHeight(childId))
        const totalChildrenHeight = childHeights.reduce((sum, height) => sum + height, 0)

        const parentY = currentY + totalChildrenHeight / 2 - (NODE_HEIGHT + 30) / 2
        updatedNodes[nodeId] = { ...node, y: parentY }

        let childY = currentY
        node.children.forEach((childId, index) => {
          childY = positionNodeAndChildren(childId, childY)
        })

        return currentY + totalChildrenHeight
      }

      const calculateDynamicPositions = () => {
        // Start with root node at fixed position
        updatedNodes.root.x = 400

        // Process each level, calculating x position based on parent's actual width
        const processLevel = (nodeIds: string[]) => {
          nodeIds.forEach((nodeId) => {
            const node = updatedNodes[nodeId]
            if (node.parentId) {
              const parent = updatedNodes[node.parentId]
              const parentDimensions = nodeDimensions[parent.id] || { width: NODE_WIDTH, height: NODE_HEIGHT }

              // Position child node with 50px gap after parent's actual width
              updatedNodes[nodeId] = {
                ...node,
                x: parent.x + parentDimensions.width + 50,
              }
            }
          })
        }

        // Group nodes by level and process each level
        const levelGroups: Record<number, string[]> = {}
        Object.values(updatedNodes).forEach((node) => {
          if (!levelGroups[node.level]) levelGroups[node.level] = []
          levelGroups[node.level].push(node.id)
        })

        // Process levels 1 and above (skip root level 0)
        Object.keys(levelGroups)
          .map(Number)
          .sort((a, b) => a - b)
          .slice(1) // Skip level 0 (root)
          .forEach((level) => {
            processLevel(levelGroups[level])
          })
      }

      // Calculate dynamic positions if we have dimension data
      if (Object.keys(nodeDimensions).length > 0) {
        calculateDynamicPositions()
      } else {
        // Fallback to fixed spacing if dimensions not available yet
        const levelGroups: Record<number, string[]> = {}
        Object.values(updatedNodes).forEach((node) => {
          if (!levelGroups[node.level]) levelGroups[node.level] = []
          levelGroups[node.level].push(node.id)
        })

        Object.entries(levelGroups).forEach(([level, nodeIds]) => {
          const levelNum = Number.parseInt(level)
          const x = 400 + levelNum * 320

          nodeIds.forEach((nodeId) => {
            const node = updatedNodes[nodeId]
            updatedNodes[nodeId] = { ...node, x }
          })
        })
      }

      positionNodeAndChildren("root", 100)

      return updatedNodes
    },
    [nodeDimensions],
  ) // Added nodeDimensions dependency

  const addChildNode = useCallback(
    (parentId: string) => {
      const newId = `node-${Date.now()}`
      const parent = nodes[parentId]

      const newNode: Node = {
        id: newId,
        text: "New Idea",
        x: parent.x + 350,
        y: parent.y,
        parentId,
        children: [],
        level: parent.level + 1,
      }

      const updatedNodes = {
        ...nodes,
        [newId]: newNode,
        [parentId]: {
          ...parent,
          children: [...parent.children, newId],
        },
      }

      const layoutedNodes = calculateLayout(updatedNodes)

      const newConnection: Connection = { from: parentId, to: newId }
      setConnections((prev) => [...prev, newConnection])

      saveToHistory(nodes)
      setNodes(layoutedNodes)
      setSelectedNode(newId)
      setEditingNode(newId)
      setEditText("") // Start with empty text for new nodes so placeholder shows
    },
    [nodes, calculateLayout, saveToHistory],
  )

  const addSiblingNode = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node.parentId) return

      addChildNode(node.parentId)
    },
    [nodes, addChildNode],
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === "root") return

      const node = nodes[nodeId]
      const parent = node.parentId ? nodes[node.parentId] : null

      saveToHistory(nodes)

      const nodesToDelete = new Set<string>()
      const collectChildren = (id: string) => {
        nodesToDelete.add(id)
        nodes[id].children.forEach(collectChildren)
      }
      collectChildren(nodeId)

      const updatedNodes = { ...nodes }
      if (parent) {
        updatedNodes[parent.id] = {
          ...parent,
          children: parent.children.filter((id) => id !== nodeId),
        }
      }

      nodesToDelete.forEach((id) => {
        delete updatedNodes[id]
      })

      setConnections((prev) => prev.filter((conn) => !nodesToDelete.has(conn.from) && !nodesToDelete.has(conn.to)))

      const layoutedNodes = calculateLayout(updatedNodes)
      setNodes(layoutedNodes)
      setSelectedNode(parent?.id || "root")
    },
    [nodes, calculateLayout, saveToHistory],
  )

  const startEditing = useCallback(
    (nodeId: string) => {
      setEditingNode(nodeId)
      const nodeText = nodes[nodeId].text
      if (nodeText === "New Idea" || nodeText === "Main Idea") {
        setEditText("")
      } else {
        setEditText(nodeText)
      }
      setSelectedNode(nodeId)
    },
    [nodes],
  )

  const saveEdit = useCallback(() => {
    if (!editingNode) return

    saveToHistory(nodes)
    setNodes((prev) => ({
      ...prev,
      [editingNode]: {
        ...prev[editingNode],
        text: editText,
      },
    }))
    setEditingNode(null)
  }, [editingNode, editText, nodes, saveToHistory])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (editingNode) return

      switch (e.key) {
        case "Tab":
          e.preventDefault()
          addChildNode(selectedNode)
          break
        case "Delete":
        case "Backspace":
          e.preventDefault()
          deleteNode(selectedNode)
          break
        case "s":
        case "S":
          e.preventDefault()
          addSiblingNode(selectedNode)
          break
        case "l":
        case "L":
          e.preventDefault()
          // Center on main idea: 10% from left, vertically middle, 90% zoom
          setZoom(0.9)
          setPan({ x: window.innerWidth * 0.1 - 400, y: window.innerHeight * 0.5 - 300 })
          setSelectedNode("root")
          break
        case "Escape":
          setEditingNode(null)
          break
      }
    },
    [selectedNode, editingNode, addChildNode, deleteNode, addSiblingNode],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setNodes(history[historyIndex - 1])
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setNodes(history[historyIndex + 1])
    }
  }, [history, historyIndex])

  const exportToJSON = useCallback(() => {
    try {
      const convertNodeToSimpleFormat = (nodeId: string): any => {
        const node = nodes[nodeId]
        const result: any = { name: node.text }

        if (node.children.length > 0) {
          result.children = node.children.map((childId) => convertNodeToSimpleFormat(childId))
        }

        return result
      }

      const mindmapData = convertNodeToSimpleFormat("root")
      const dataStr = JSON.stringify(mindmapData, null, 2)
      const dataBlob = new Blob([dataStr], { type: "application/json" })

      const link = document.createElement("a")
      link.href = URL.createObjectURL(dataBlob)
      link.download = `mindmap-${new Date().toISOString().split("T")[0]}.json`
      link.click()

      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error("Export failed:", error)
      alert(`Export failed: ${error}`)
    }
  }, [nodes])

  const importFromJSON = useCallback(
    (jsonData: string) => {
      try {
        const data = JSON.parse(jsonData)

        if (!data.name || typeof data.name !== "string") {
          throw new Error("Invalid JSON format: missing root name")
        }

        const convertToInternalFormat = (
          simpleNode: any,
          parentId: string | null = null,
          level = 0,
        ): Record<string, Node> => {
          const nodeId = level === 0 ? "root" : `node-${Date.now()}-${Math.random()}`
          const nodes: Record<string, Node> = {}

          const node: Node = {
            id: nodeId,
            text: simpleNode.name,
            x: 400 + level * 320,
            y: 300,
            parentId,
            children: [],
            level,
          }

          nodes[nodeId] = node

          if (simpleNode.children && Array.isArray(simpleNode.children)) {
            simpleNode.children.forEach((child: any, index: number) => {
              const childNodes = convertToInternalFormat(child, nodeId, level + 1)
              const childId = Object.keys(childNodes)[0]
              node.children.push(childId)
              Object.assign(nodes, childNodes)
            })
          }

          return nodes
        }

        const newNodes = convertToInternalFormat(data)
        saveToHistory(nodes)
        const layoutedNodes = calculateLayout(newNodes)
        setNodes(layoutedNodes)
        setSelectedNode("root")
        setShowImportModal(false)
        setImportText("")
      } catch (error) {
        console.error("Import failed:", error)
        alert(`Import failed: ${error}`)
      }
    },
    [nodes, saveToHistory, calculateLayout],
  )

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        if (content) {
          importFromJSON(content)
        }
      }
      reader.readAsText(file)

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [importFromJSON],
  )

  const zoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3))
  const zoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.3))

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target === containerRef.current || target === svgRef.current || target === canvasRef.current) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      e.preventDefault()
    }
  }

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
        e.preventDefault()
      }
    }

    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()

        const container = containerRef.current
        if (container) {
          const scrollCompensation = e.deltaY * 2.0 // Adjust multiplier as needed

          // Zoom based on scroll direction
          if (e.deltaY < 0) {
            setZoom((prev) => Math.min(prev * 1.1, 3))
            // Counter-scroll down to compensate for upward scroll
            container.scrollTop += scrollCompensation
          } else {
            setZoom((prev) => Math.max(prev / 1.1, 0.3))
            // Counter-scroll up to compensate for downward scroll
            container.scrollTop += scrollCompensation
          }
        }
      }
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleGlobalMouseMove)
      document.addEventListener("mouseup", handleGlobalMouseUp)
    }

    document.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove)
      document.removeEventListener("mouseup", handleGlobalMouseUp)
      document.removeEventListener("wheel", handleWheel)
    }
  }, [isDragging, dragStart])

  const generatePath = (from: Node, to: Node) => {
    const fromDimensions = nodeDimensions[from.id] || { width: NODE_WIDTH, height: NODE_HEIGHT }
    const toDimensions = nodeDimensions[to.id] || { width: NODE_WIDTH, height: NODE_HEIGHT }

    const fromX = from.x + fromDimensions.width
    const fromY = from.y
    const toX = to.x
    const toY = to.y

    const midX = fromX + (toX - fromX) * 0.5

    return `M ${fromX} ${fromY} C ${midX} ${fromY} ${midX} ${toY} ${toX} ${toY}`
  }

  useEffect(() => {
    const newConnections: Connection[] = []
    Object.values(nodes).forEach((node) => {
      if (node.parentId && nodes[node.parentId]) {
        newConnections.push({ from: node.parentId, to: node.id })
      }
    })
    setConnections(newConnections)
  }, [nodes])

  return (
    <div className="w-screen h-screen bg-gray-50 overflow-auto relative">
      <div className="fixed top-4 right-4 z-20 flex gap-2">
        <Button variant="outline" size="sm" onClick={exportToJSON} className="bg-white shadow-md">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)} className="bg-white shadow-md">
          <Upload className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0} className="bg-white shadow-md">
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className="bg-white shadow-md"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={zoomOut} className="bg-white shadow-md">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={zoomIn} className="bg-white shadow-md">
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw] shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Import Mind Map</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paste JSON data:</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your mind map JSON data here..."
                  className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="text-center text-gray-500">or</div>

              <div>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload JSON File
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={() => importFromJSON(importText)} disabled={!importText.trim()} className="flex-1">
                Import
              </Button>
              <Button
                onClick={() => {
                  setShowImportModal(false)
                  setImportText("")
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full h-full ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          scrollbarWidth: "auto",
          scrollbarColor: "#cbd5e1 #f1f5f9",
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          ref={canvasRef}
          className="relative transition-transform duration-200 ease-out"
          style={{
            width: "4000px",
            height: "3000px",
            minWidth: "100vw",
            minHeight: "100vh",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.15) 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        >
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ width: "100%", height: "100%" }}
          >
            {connections.map((conn) => {
              const fromNode = nodes[conn.from]
              const toNode = nodes[conn.to]
              if (!fromNode || !toNode) return null

              return (
                <path
                  key={`${conn.from}-${conn.to}`}
                  d={generatePath(fromNode, toNode)}
                  stroke="url(#gradient)"
                  strokeWidth="3"
                  fill="none"
                  className="drop-shadow-sm"
                />
              )
            })}

            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.6" />
              </linearGradient>
            </defs>
          </svg>

          {Object.values(nodes).map((node) => {
            const colorClass = COLORS[node.level % COLORS.length]
            const isSelected = selectedNode === node.id

            return (
              <div
                key={node.id}
                className="absolute transition-all duration-300 ease-out animate-in fade-in slide-in-from-left-4"
                style={{
                  left: node.x,
                  top: node.y,
                  transform: "translate(0, -50%)",
                }}
              >
                <div
                  ref={(el) => {
                    if (el) nodeRefs.current[node.id] = el
                  }}
                  className={`
                  relative bg-gradient-to-r ${colorClass} 
                  rounded-xl shadow-lg hover:shadow-xl 
                  transition-all duration-200 ease-out
                  min-w-[${NODE_WIDTH}px] min-h-[${NODE_HEIGHT}px]
                  flex items-center justify-between
                  group cursor-pointer
                  border-2 ${isSelected ? "border-white border-opacity-60" : "border-white/20"}
                `}
                  onClick={() => setSelectedNode(node.id)}
                >
                  <div className="flex-1 px-4 py-3">
                    {editingNode === node.id ? (
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit()
                          if (e.key === "Escape") setEditingNode(null)
                        }}
                        className="w-full bg-transparent text-white placeholder-white/70 outline-none font-medium text-base"
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(node.id)}
                        className="text-white font-medium text-base leading-tight cursor-text hover:bg-white/10 rounded px-1 py-0.5 transition-colors"
                      >
                        {node.text}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        addChildNode(node.id)
                      }}
                      className="
                        w-8 h-8 rounded-full bg-white/20 hover:bg-white/30
                        flex items-center justify-center
                        transition-all duration-200 ease-out
                        hover:scale-110 active:scale-95
                      "
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                    {node.id !== "root" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNode(node.id)
                        }}
                        className="
                          w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30
                          flex items-center justify-center
                          transition-all duration-200 ease-out
                          hover:scale-110 active:scale-95
                        "
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="fixed bottom-4 left-4 z-20 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg text-xs text-gray-600">
        <div className="space-y-1">
          <div>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> Add child node
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">S</kbd> Add sibling node
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Delete</kbd> Delete node
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">L</kbd> Center on main idea
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Cmd/Ctrl + Scroll</kbd> Zoom
          </div>
        </div>
      </div>
    </div>
  )
}
