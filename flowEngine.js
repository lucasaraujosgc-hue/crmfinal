

async function processFlowNode(callbacks, db, leadData, campaignData, nodeId, userInput = null) {
    if (!campaignData || !campaignData.flow_nodes) {
        return; // No flow data
    }

    let nodes = [];
    let edges = [];
    try {
        nodes = JSON.parse(campaignData.flow_nodes) || [];
        edges = JSON.parse(campaignData.flow_edges) || [];
    } catch (e) {
        return;
    }

    if (nodes.length === 0) return;

    // Find the next node to process. If we don't have one, find entry node.
    let currentNodeId = nodeId;
    if (!currentNodeId) {
        // Find a node that has no incoming edges, or just the first node
        const targetNodes = new Set(edges.map(e => e.target));
        const entryNodes = nodes.filter(n => !targetNodes.has(n.id));
        currentNodeId = entryNodes.length > 0 ? entryNodes[0].id : nodes[0].id;
    }

    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (!currentNode) return; // Flow ended or invalid
    
    // Process current node
    const processResult = await executeNode(callbacks, currentNode, leadData, userInput, edges, nodes);
    
    // Update state in DB
    if (processResult.nextNodeId) {
        // Move to next node immediately (or schedule loosely)
        db.run('UPDATE resultado SET current_node_id = ? WHERE id = ?', [processResult.nextNodeId, leadData.id], () => {
            if (processResult.delay > 0) {
                setTimeout(() => {
                    processFlowNode(callbacks, db, leadData, campaignData, processResult.nextNodeId, null).catch(console.error);
                }, processResult.delay);
            } else {
                setImmediate(() => {
                    processFlowNode(callbacks, db, leadData, campaignData, processResult.nextNodeId, null).catch(console.error);
                });
            }
        });
    } else if (processResult.wait) {
        // Wait for user input at current node
        db.run('UPDATE resultado SET current_node_id = ? WHERE id = ?', [currentNodeId, leadData.id]);
    } else {
        // Flow finished
        db.run('UPDATE resultado SET current_node_id = NULL, campaign_status = "flow_finished" WHERE id = ?', [leadData.id]);
    }
}

async function executeNode(callbacks, node, leadData, userInput, edges, nodes) {
    const { sendMessage, sendMedia, askAi, log } = callbacks;
    const type = node.type;
    const data = node.data || {};
    
    let nextNodeId = findNextNode(node.id, edges);

    const hydrateStr = (str) => {
        if(!str) return '';
        return str
            .replace(/\{\{razaoSocial\}\}/g, leadData.razao_social || '')
            .replace(/\{\{nomeFantasia\}\}/g, leadData.nome_fantasia || '')
            .replace(/\{\{cnpj\}\}/g, leadData.cnpj || '')
            .replace(/\{\{municipio\}\}/g, leadData.municipio || '')
            .replace(/\{\{uf\}\}/g, leadData.uf || '')
            .replace(/\{\{situacaoCadastral\}\}/g, leadData.situacao_cadastral || '')
            .replace(/\{\{inscricaoEstadual\}\}/g, leadData.inscricao_estadual || '')
            .replace(/\{\{motivoSituacao\}\}/g, leadData.motivo_situacao || '');
    };

    if (type === 'message' || type === 'ticket') {
        if (!userInput) { // Need to send message
            const text = hydrateStr(data.label);
            log('msg_out', 'flow', `Sent message from flow to ${leadData.telefone}`);
            await sendMessage(leadData.wa_id, text);
            // After sending, proceed to next node
            return { nextNodeId, delay: 2000 + Math.random() * 2000 };
        } else {
            // Already processing next node, ignore userInput unless wait=true.
            // Message nodes don't wait for input.
            return { nextNodeId, delay: 1000 };
        }
    }
    
    if (type === 'media') {
         if (!userInput) {
             if (data.mediaData) {
                 await sendMedia(leadData.wa_id, data.mediaData, hydrateStr(data.label));
             }
             return { nextNodeId, delay: 3000 };
         }
         return { nextNodeId, delay: 500 };
    }
    
    if (type === 'interval') {
         const delay = (data.seconds || 5) * 1000;
         return { nextNodeId, delay };
    }
    
    if (type === 'menu') {
        if (!userInput) {
            // Send menu options
            let menuText = hydrateStr(data.label) + "\n\n";
            (data.options || []).forEach((opt, idx) => {
                menuText += `[${idx+1}] ${opt.label}\n`;
            });
            await sendMessage(leadData.wa_id, menuText);
            return { wait: true }; // Pause flow execution at this node
        } else {
             // We received an input! Evaluate it.
             const num = parseInt(userInput.trim());
             let chosenOptionIndex = -1;
             
             if (!isNaN(num) && num > 0 && num <= (data.options || []).length) {
                 chosenOptionIndex = num - 1;
             }
             
             if (chosenOptionIndex === -1) {
                 // Invalid choice, optionally alert or fallback. Just fallback for simplicity.
                 const fallbackEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'fallback');
                 return { nextNodeId: fallbackEdge ? fallbackEdge.target : null, delay: 500 };
             } else {
                 const chosenEdge = edges.find(e => e.source === node.id && e.sourceHandle === `opt-${chosenOptionIndex}`);
                 return { nextNodeId: chosenEdge ? chosenEdge.target : null, delay: 500 };
             }
        }
    }
    
    if (type === 'ai_generate') {
        const text = await askAi(hydrateStr(data.label) + "\n\nResponda diretamente sem placeholders. Base: " + JSON.stringify(leadData));
        await sendMessage(leadData.wa_id, text);
        return { nextNodeId, delay: 2000 };
    }
    
    if (type === 'ai') {
        if (!userInput) {
            // The instructions for AI node say: it evaluates user response. So it expects a response before this node!
            return { wait: true };
        } else {
             // Evaluate user input via AI router
             const options = data.options || [];
             if (options.length === 0) return { nextNodeId, delay: 500 };
             
             let prompt = `Avalie a seguinte mensagem do usuário no contexto e escolha a opção que melhor se encaixa.
Instrução do contexto: "${hydrateStr(data.label)}"
Mensagem do usuário: "${userInput}"
Opções disponíveis:
`;
             options.forEach((opt, idx) => prompt += `[${idx+1}] ${opt.label}\n`);
             prompt += `\nRetorne EXATAMENTE APENAS O NÚMERO da melhor opção. (ex: "1" ou "2"). Caso nenhuma se aplique perfeitamente, retorne "fallback".`;
             
             const aiEval = await askAi(prompt);
             const num = parseInt(aiEval.replace(/\D/g, ''));
             
             let chosenOptionIndex = -1;
             if (!isNaN(num) && num > 0 && num <= options.length) {
                 chosenOptionIndex = num - 1;
             }
             
             if (chosenOptionIndex === -1) {
                 const fallbackEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'fallback');
                 return { nextNodeId: fallbackEdge ? fallbackEdge.target : null, delay: 500 };
             } else {
                 const chosenEdge = edges.find(e => e.source === node.id && e.sourceHandle === `opt-${chosenOptionIndex}`);
                 return { nextNodeId: chosenEdge ? chosenEdge.target : null, delay: 500 };
             }
        }
    }

    return { nextNodeId: null };
}

function findNextNode(sourceId, edges) {
    const edge = edges.find(e => e.source === sourceId && (!e.sourceHandle || e.sourceHandle === 'fallback' || e.sourceHandle === 'bottom'));
    return edge ? edge.target : null;
}

export { processFlowNode };
