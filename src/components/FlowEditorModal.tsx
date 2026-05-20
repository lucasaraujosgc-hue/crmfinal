import React, { useState, useCallback } from 'react';
import { ReactFlow, Controls, Background, addEdge, BackgroundVariant, applyNodeChanges, applyEdgeChanges, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, Save, MessageCircle, Clock, List, FileText } from 'lucide-react';

const nodeTypesConfig = [
  { type: 'message', label: 'Mensagem', icon: MessageCircle, color: 'border-blue-400 bg-blue-50' },
  { type: 'interval', label: 'Intervalo', icon: Clock, color: 'border-amber-400 bg-amber-50' },
  { type: 'menu', label: 'Menu', icon: List, color: 'border-purple-400 bg-purple-50' },
  { type: 'ticket', label: 'Ticket', icon: FileText, color: 'border-emerald-400 bg-emerald-50' }
];

const FlowNode = ({ data, type }: any) => {
    const config = nodeTypesConfig.find(c => c.type === type) || nodeTypesConfig[0];
    const Icon = config.icon;
    return (
        <div className={`px-4 py-2 shadow-sm rounded-md bg-white border-2 ${config.color} min-w-[200px]`}>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                <Icon size={16} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-700 uppercase">{config.label}</span>
            </div>
            <div className="text-sm text-slate-600 font-medium">
                {data.label}
            </div>
        </div>
    );
};

const nodeTypes = {
  message: (props: any) => <FlowNode {...props} type="message" />,
  interval: (props: any) => <FlowNode {...props} type="interval" />,
  menu: (props: any) => <FlowNode {...props} type="menu" />,
  ticket: (props: any) => <FlowNode {...props} type="ticket" />
};

export const FlowEditorModal = ({ rule, onClose, onSave }: { rule: any, onClose: () => void, onSave: (nodes: any[], edges: any[]) => void }) => {
    const [nodes, setNodes] = useState<any[]>(rule.flowNodes || [
        { id: '1', type: 'message', position: { x: 100, y: 100 }, data: { label: 'Início do fluxo' } }
    ]);
    const [edges, setEdges] = useState<any[]>(rule.flowEdges || []);

    const onNodesChange = useCallback(
        (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    );

    const onConnect = useCallback(
        (params: any) => setEdges((eds) => addEdge(params, eds)),
        [],
    );

    const handleAddNode = (type: string) => {
        const id = Date.now().toString();
        const newNode = {
            id,
            type,
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
            data: { label: `Novo ${type}` }
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const handleNodeDoubleClick = (_: React.MouseEvent, node: any) => {
        const newLabel = prompt('Editar texto/valor:', node.data.label);
        if (newLabel !== null) {
            setNodes((nds) => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n));
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-5xl h-[80vh] rounded-lg shadow-xl flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white z-10 w-full rounded-t-lg">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Flow Builder IA</h3>
                        <p className="text-xs text-slate-500">Motivo: {rule.motivoSituacao}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onSave(nodes, edges)} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium flex items-center gap-2">
                            <Save size={16} /> Salvar Fluxo
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-md text-slate-400 transition-colors"><X size={20}/></button>
                    </div>
                </div>
                
                <div className="flex-1 relative w-full h-full bg-slate-50">
                    <ReactFlow 
                        nodes={nodes} 
                        edges={edges} 
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeDoubleClick={handleNodeDoubleClick}
                        nodeTypes={nodeTypes}
                        fitView
                    >
                        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                        <Controls />
                        <Panel position="top-left" className="bg-white p-2 rounded-md shadow-sm border border-slate-200 flex flex-col gap-2 m-2">
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Adicionar</div>
                            {nodeTypesConfig.map(config => (
                                <button 
                                    key={config.type} 
                                    onClick={() => handleAddNode(config.type)}
                                    className="flex items-center gap-2 p-2 hover:bg-slate-50 text-sm text-slate-700 rounded-md transition-colors text-left"
                                >
                                    <config.icon size={16} className="text-slate-400" />
                                    {config.label}
                                </button>
                            ))}
                            <div className="text-[10px] text-slate-400 mt-2 max-w-[120px]">
                                Double-click num nó para editar o texto. Ligue os pontos para criar o fluxo.
                            </div>
                        </Panel>
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
};
