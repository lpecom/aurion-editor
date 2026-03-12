import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  Node,
  Edge,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntryNode from './nodes/EntryNode';
import PageNode from './nodes/PageNode';
import RedirectNode from './nodes/RedirectNode';

interface FunnelCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect?: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onDrop?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onPaneClick?: () => void;
}

const nodeTypes: NodeTypes = {
  entry: EntryNode,
  page: PageNode,
  redirect: RedirectNode,
};

const defaultEdgeOptions = {
  animated: true,
  type: 'smoothstep',
  style: { stroke: '#22c55e', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#22c55e',
    width: 16,
    height: 16,
  },
};

const canvasStyles = `
  .react-flow__node {
    color: #fafafa;
  }
  .react-flow__edge-path {
    stroke: #22c55e;
    stroke-width: 2;
  }
  .react-flow__connection-line {
    stroke: #22c55e;
    stroke-width: 2;
    stroke-dasharray: 5 5;
  }
  .react-flow__controls {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(39, 39, 42, 0.8);
  }
  .react-flow__controls button {
    background: #131316;
    color: #a1a1aa;
    border-color: rgba(39, 39, 42, 0.5);
    width: 32px;
    height: 32px;
    transition: all 0.15s ease;
  }
  .react-flow__controls button:hover {
    background: #1c1c21;
    color: #fafafa;
  }
  .react-flow__minimap {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(39, 39, 42, 0.8);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  }
`;

function FunnelCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onDrop,
  onDragOver,
  onPaneClick,
}: FunnelCanvasProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <style>{canvasStyles}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        colorMode="dark"
        snapToGrid
        snapGrid={[20, 20]}
        deleteKeyCode="Backspace"
        fitView
      >
        <MiniMap
          position="bottom-right"
          style={{ background: '#131316' }}
          maskColor="rgba(0, 0, 0, 0.7)"
          nodeColor="#22c55e"
        />
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(161, 161, 170, 0.15)" />
      </ReactFlow>
    </div>
  );
}

export default FunnelCanvas;
