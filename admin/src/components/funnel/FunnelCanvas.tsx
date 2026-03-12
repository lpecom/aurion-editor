import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
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
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
}

const nodeTypes: NodeTypes = {
  entry: EntryNode,
  page: PageNode,
  redirect: RedirectNode,
};

const defaultEdgeOptions = {
  animated: true,
  type: 'smoothstep',
  style: { stroke: '#22c55e' },
};

const canvasStyles = `
  .react-flow__node {
    color: #e2e8f0;
  }
  .react-flow__edge-path {
    stroke: #22c55e;
  }
  .react-flow__controls button {
    background: #1e1e1e;
    color: #e2e8f0;
    border-color: #2a2a2a;
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
          style={{ background: '#1e1e1e' }}
          maskColor="rgba(0, 0, 0, 0.6)"
          nodeColor="#22c55e"
        />
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}

export default FunnelCanvas;
