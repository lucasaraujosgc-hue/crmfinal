import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlow, Controls, Background, addEdge, BackgroundVariant, applyNodeChanges, applyEdgeChanges, Handle, Position, useUpdateNodeInternals, NodeResizer } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, Save, MessageCircle, Clock, List, FileText, Image, Mic, Bot, Upload, CheckCircle } from 'lucide-react';

const nodeTypesConfig = [
  { type: 'message', label: 'Mensagem', icon: MessageCircle, color: 'border-blue-400 bg-blue-50 text-blue-700' },
  { type: 'media', label: 'Mídia (Img/Áudio)', icon: Image, color: 'border-pink-400 bg-pink-50 text-pink-700' },
  { type: 'interval', label: 'Intervalo', icon: Clock, color: 'border-amber-400 bg-amber-50 text-amber-700' },
  { type: 'menu', label: 'Menu', icon: List, color: 'border-purple-400 bg-purple-50 text-purple-700' },
  { type: 'ai', label: 'Análise IA (Roteador)', icon: Bot, color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { type: 'ai_generate', label: 'Gerar Resposta IA', icon: Bot, color: 'border-teal-400 bg-teal-50 text-teal-700' },
  { type: 'ticket', label: 'Ticket', icon: FileText, color: 'border-indigo-400 bg-indigo-50 text-indigo-700' }
];

const FlowNode = ({ id, data, type, isConnectable, selected }: any) => {
    const config = nodeTypesConfig.find(c => c.type === type) || nodeTypesConfig[0];
    const Icon = config.icon;
    const hasOptions = type === 'menu' || type === 'ai';
    
    const updateNodeInternals = useUpdateNodeInternals();
    const optionsLength = data?.options?.length || 0;
    useEffect(() => {
        updateNodeInternals(id);
    }, [optionsLength, id, updateNodeInternals]);

    
    return (
        <div className={`shadow-sm rounded-lg bg-white border border-slate-300 ${config.color.split(' ')[0]} min-w-[140px] w-full h-full text-slate-800 relative`}>
            <NodeResizer minWidth={140} isVisible={selected} handleStyle={{ width: 6, height: 6 }} />
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-1.5 h-1.5 border border-slate-300 bg-white" />
            <div className={`flex items-center gap-1.5 px-2 py-1 border-b border-slate-100 ${config.color.split(' ')[1]}`}>
                <Icon size={10} className={config.color.split(' ')[2]} />
                <span className="text-[8px] font-bold uppercase tracking-wider">{config.label}</span>
            </div>
            
            <div className="p-1.5">
                {type === 'media' && data.mediaType === 'audio' && (
                    <div className="w-full bg-slate-100 rounded-full py-0.5 px-1.5 flex items-center gap-1 mb-1">
                        <Mic size={10} className="text-brand-500" />
                        <div className="flex-1 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-400 w-1/3 rounded-full"></div>
                        </div>
                        <span className="text-[8px] text-slate-500 font-medium whitespace-nowrap">0:12</span>
                    </div>
                )}
                
                {type === 'media' && data.mediaType === 'image' && data.mediaData && (
                    <div className="w-full h-12 bg-slate-100 rounded-sm mb-1 overflow-hidden flex items-center justify-center">
                        <img src={data.mediaData} alt="upload" className="max-w-full max-h-full object-cover" />
                    </div>
                )}

                {type === 'interval' && (
                    <div className="text-[10px] font-semibold text-center text-amber-700 mb-1">
                        Aguardar {data.seconds || 5}s
                    </div>
                )}
                
                {data.label && (
                    <div className="text-[10px] leading-tight font-medium whitespace-pre-wrap break-words">{data.label}</div>
                )}

                {hasOptions && data.options && data.options.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                        {data.options.map((opt: any, i: number) => (
                            <div key={i} className="text-[9px] bg-slate-50 border border-slate-100 rounded px-1 py-0.5 flex items-center justify-between">
                                <span className="truncate max-w-[90%]">[{i+1}] {opt.label}</span>
                                <Handle type="source" position={Position.Right} id={`opt-${i}`} className="w-1.5 h-1.5" style={{ position: 'relative', right: 0, transform: 'none', top: 'auto', bottom: 'auto' }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Default Source Handle at bottom */}
            {!hasOptions && (
                <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-1.5 h-1.5 border border-slate-300 bg-white" />
            )}
            {hasOptions && (
                <Handle type="source" position={Position.Bottom} id="fallback" className="w-1.5 h-1.5 border border-slate-300 bg-slate-200" title="Fallback / Time-out" />
            )}
        </div>
    );
};

const nodeTypes = {
  message: (props: any) => <FlowNode {...props} type="message" />,
  media: (props: any) => <FlowNode {...props} type="media" />,
  interval: (props: any) => <FlowNode {...props} type="interval" />,
  menu: (props: any) => <FlowNode {...props} type="menu" />,
  ai: (props: any) => <FlowNode {...props} type="ai" />,
  ai_generate: (props: any) => <FlowNode {...props} type="ai_generate" />,
  ticket: (props: any) => <FlowNode {...props} type="ticket" />
};

export const FlowEditorModal = ({ rule, onClose, onSave }: { rule: any, onClose: () => void, onSave: (nodes: any[], edges: any[]) => void }) => {
    const [nodes, setNodes] = useState<any[]>(rule.flowNodes || [
        { id: '1', type: 'message', position: { x: 250, y: 100 }, data: { label: 'Olá! Como posso ajudar?' } }
    ]);
    const [edges, setEdges] = useState<any[]>(rule.flowEdges || []);
    
    // For editing node properties
    const [editingNode, setEditingNode] = useState<any | null>(null);

    const onNodesChange = useCallback(
        (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    );

    const onConnect = useCallback(
        (params: any) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [],
    );

    const handleAddNode = (type: string) => {
        const id = Date.now().toString();
        let initialData: any = { label: `Novo ${type}` };
        
        if (type === 'menu' || type === 'ai') {
            initialData.options = [{ label: 'Sim' }, { label: 'Não' }];
        } else if (type === 'media') {
            initialData.mediaType = 'image';
            initialData.label = 'Legenda opcional';
        } else if (type === 'ai_generate') {
            initialData.label = 'Você é um assistente... gere uma resposta.';
        } else if (type === 'interval') {
            initialData.seconds = 5;
            initialData.label = '';
        }
        
        const newNode = {
            id,
            type,
            position: { x: Math.random() * 100 + 400, y: Math.random() * 100 + 200 },
            data: initialData
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const handleNodeDoubleClick = (_: React.MouseEvent, node: any) => {
        setEditingNode(node);
    };

    const handleSaveNodeEdit = (updatedData: any) => {
        setNodes(nds => nds.map(n => n.id === editingNode.id ? { ...n, data: updatedData } : n));
        setEditingNode(null);
    };

    const handleDeleteNode = () => {
        setNodes(nds => nds.filter(n => n.id !== editingNode.id));
        setEdges(eds => eds.filter(e => e.source !== editingNode.id && e.target !== editingNode.id));
        setEditingNode(null);
    };

    const edgeColors = ['#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    const handleEdgeClick = useCallback((_: any, edge: any) => {
        setEdges(eds => eds.map(e => {
            if (e.id === edge.id) {
                const currentColor = e.style?.stroke || '#b1b1b7';
                const nextIndex = (edgeColors.indexOf(currentColor) + 1) % edgeColors.length;
                return { ...e, style: { ...e.style, stroke: edgeColors[nextIndex], strokeWidth: 3 } };
            }
            return e;
        }));
    }, [setEdges, edgeColors]);

    const handleEdgeDoubleClick = useCallback((_: any, edge: any) => {
        setEdges(eds => eds.filter(e => e.id !== edge.id));
    }, [setEdges]);

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white z-10 w-full relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
                            <Bot size={20} className="text-brand-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 leading-tight">Flow Builder IA</h3>
                            <p className="text-xs text-slate-500 font-medium">Motivo/Contexto: {rule.motivoSituacao}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => onSave(nodes, edges)} className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95">
                            <Save size={16} /> Salvar Fluxo
                        </button>
                        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X size={20}/></button>
                    </div>
                </div>
                
                <div className="flex-1 relative w-full h-full bg-[#f8fafc]">
                    {/* Toolbar lateral embutida no Flow */}
                    <div className="absolute left-4 top-4 z-10 bg-white rounded-xl shadow-sm border border-slate-200 w-48 flex flex-col gap-1 overflow-hidden">
                        <div className="py-3 px-4 bg-slate-50 border-b border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Componentes</span>
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            {nodeTypesConfig.map(config => (
                                <button 
                                    key={config.type} 
                                    onClick={() => handleAddNode(config.type)}
                                    className="flex items-center gap-3 p-2.5 hover:bg-slate-50 text-sm text-slate-700 rounded-lg outline-none transition-colors group text-left"
                                >
                                    <div className={`p-1.5 rounded-md bg-white border shadow-sm ${config.color.split(' ')[0]} ${config.color.split(' ')[2]}`}>
                                        <config.icon size={14} />
                                    </div>
                                    <span className="font-medium group-hover:text-brand-600 transition-colors">{config.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <ReactFlow 
                        nodes={nodes} 
                        edges={edges} 
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeDoubleClick={handleNodeDoubleClick}
                        onEdgeClick={handleEdgeClick}
                        onEdgeDoubleClick={handleEdgeDoubleClick}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-[#f8fafc]"
                    >
                        <Background variant={BackgroundVariant.Dots} gap={16} size={2} color="#cbd5e1" />
                        <Controls className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden" />
                    </ReactFlow>
                    
                    {/* Dica de Uso */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-sm border border-slate-200 text-xs text-slate-500 font-medium flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
                            Clique duplo no nó para editar
                        </div>
                        <div className="w-px h-3 bg-slate-300"></div>
                        <div className="flex items-center gap-2">
                            Clique na linha para colorir
                        </div>
                        <div className="w-px h-3 bg-slate-300"></div>
                        <div className="flex items-center gap-2">
                            Clique duplo na linha para excluir
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Editor de Propriedades Modal */}
            {editingNode && (
                <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-end">
                    <div className="w-[400px] h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                    Editar Componente
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 capitalize">{editingNode.type}</p>
                            </div>
                            <button onClick={() => setEditingNode(null)} className="p-2 hover:bg-slate-200/50 rounded-full text-slate-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            {editingNode.type === 'media' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Mídia</label>
                                        <select 
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                                            value={editingNode.data.mediaType || 'image'}
                                            onChange={e => setEditingNode({...editingNode, data: {...editingNode.data, mediaType: e.target.value}})}
                                        >
                                            <option value="image">Imagem / Foto</option>
                                            <option value="audio">Áudio (Voz simulada)</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Aquivo / Upload</label>
                                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                            <input 
                                                type="file" 
                                                accept={editingNode.data.mediaType === 'audio' ? 'audio/*' : 'image/*'}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setEditingNode({...editingNode, data: {...editingNode.data, mediaData: reader.result}});
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                            {editingNode.data.mediaData ? (
                                                <div className="flex flex-col items-center">
                                                    <div className="text-emerald-500 mb-2"><CheckCircle size={24} /></div>
                                                    <span className="text-sm font-medium text-slate-700">Mídia Carregada!</span>
                                                    <span className="text-xs text-slate-500 mt-1">Clique para alterar</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center opacity-60 pointer-events-none">
                                                    <Upload size={24} className="mb-2" />
                                                    <span className="text-sm font-medium">Clique ou arraste o arquivo</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editingNode.type === 'interval' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Tempo (Segundos)</label>
                                        <input 
                                            type="number"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                                            value={editingNode.data.seconds || 5}
                                            onChange={e => setEditingNode({...editingNode, data: {...editingNode.data, seconds: parseInt(e.target.value) || 0}})}
                                        />
                                    </div>
                                </div>
                            )}

                            {editingNode.type !== 'interval' && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {editingNode.type === 'ai_generate' || editingNode.type === 'ai' ? 'Instruções para IA' : 'Texto / Conteúdo'}
                                </label>
                                {(editingNode.type === 'message' || editingNode.type === 'ticket') && (
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {[
                                            { label: 'Razão Social', val: '{{razaoSocial}}' },
                                            { label: 'Nome Fantasia', val: '{{nomeFantasia}}' },
                                            { label: 'CNPJ', val: '{{cnpj}}' },
                                            { label: 'Município', val: '{{municipio}}' },
                                            { label: 'UF', val: '{{uf}}' },
                                            { label: 'Situação', val: '{{situacaoCadastral}}' },
                                            { label: 'IE', val: '{{inscricaoEstadual}}' },
                                            { label: 'Motivo', val: '{{motivoSituacao}}' },
                                            { label: 'Contador', val: '{{nomeContador}}' }
                                        ].map((v, i) => (
                                            <button 
                                                key={i}
                                                onClick={() => setEditingNode({...editingNode, data: {...editingNode.data, label: (editingNode.data.label || '') + v.val}})}
                                                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-200 transition-colors"
                                                title={`Inserir ${v.val}`}
                                            >
                                                +{v.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <textarea 
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none h-32 resize-none"
                                    value={editingNode.data.label || ''}
                                    onChange={e => setEditingNode({...editingNode, data: {...editingNode.data, label: e.target.value}})}
                                    placeholder={editingNode.type.startsWith('ai') ? "Ex: Avalie se o usuário aceitou a proposta..." : "Texto da mensagem..."}
                                />
                            </div>
                            )}

                            {(editingNode.type === 'menu' || editingNode.type === 'ai') && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex justify-between items-center">
                                        Opções de Resposta
                                        <button 
                                            onClick={() => {
                                                const opts = [...(editingNode.data.options || []), { label: `Nova Opção` }];
                                                setEditingNode({...editingNode, data: {...editingNode.data, options: opts}});
                                            }}
                                            className="text-brand-600 hover:text-brand-700 text-xs font-semibold py-1 px-2 bg-brand-50 rounded-md"
                                        >
                                            + ADICIONAR
                                        </button>
                                    </label>
                                    <div className="space-y-2">
                                        {(editingNode.data.options || []).map((opt: any, i: number) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <span className="text-xs font-bold w-6 text-center text-slate-400 bg-slate-100 rounded-md py-1.5 border border-slate-200">{i+1}</span>
                                                <input 
                                                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-500"
                                                    value={opt.label}
                                                    onChange={e => {
                                                        const opts = [...editingNode.data.options];
                                                        opts[i] = { ...opts[i], label: e.target.value };
                                                        setEditingNode({...editingNode, data: {...editingNode.data, options: opts}});
                                                    }}
                                                />
                                                <button 
                                                    onClick={() => {
                                                        const opts = editingNode.data.options.filter((_:any, idx:number) => idx !== i);
                                                        setEditingNode({...editingNode, data: {...editingNode.data, options: opts}});
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                        <div className="p-5 border-t border-slate-100 bg-white bottom-0 space-y-2">
                            <button 
                                onClick={() => handleSaveNodeEdit(editingNode.data)}
                                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
                            >
                                Confirmar Edição
                            </button>
                            <button 
                                onClick={handleDeleteNode}
                                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-semibold transition-all shadow-sm"
                            >
                                Excluir {editingNode.type}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
