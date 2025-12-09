import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

// Type definitions for Flowise agentFlowExecutedData
interface AgentFlowNode {
  nodeId: string;
  nodeLabel: string;
  data: {
    id?: string;
    name?: string;
    state?: {
      reasoning?: string;
      task?: string;
      next?: string;
      [key: string]: any;
    };
    output?: {
      reasoning?: string;
      task?: string;
      next?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  previousNodeIds?: string[];
  status: string;
}

interface AIThinkingCollapsibleProps {
  agentFlowData: AgentFlowNode[];
}

// Extract reasoning and task from LLM nodes (the nodes that contain AI thinking)
function extractThinkingNodes(agentFlowData: AgentFlowNode[]): Array<{
  nodeLabel: string;
  reasoning: string;
  task: string;
  next: string;
}> {
  const thinkingNodes: Array<{
    nodeLabel: string;
    reasoning: string;
    task: string;
    next: string;
  }> = [];

  for (const node of agentFlowData) {
    // Look for nodes that have reasoning/task in their state or output
    // These are typically llmAgentflow nodes (Supervisor Worker, State, Kolektor, etc.)
    const state = node.data?.state;
    const output = node.data?.output;

    // Prefer state over output as it represents the final state
    const reasoning = state?.reasoning || output?.reasoning;
    const task = state?.task || output?.task;
    const next = state?.next || output?.next;

    // Only include nodes that have reasoning or task
    if (reasoning || task) {
      thinkingNodes.push({
        nodeLabel: node.nodeLabel || node.nodeId,
        reasoning: reasoning || '',
        task: task || '',
        next: next || ''
      });
    }
  }

  // Remove duplicates (same node might appear multiple times in loops)
  // Keep the last occurrence as it has the most recent state
  const uniqueNodes = new Map<string, typeof thinkingNodes[0]>();
  for (const node of thinkingNodes) {
    uniqueNodes.set(node.nodeLabel, node);
  }

  return Array.from(uniqueNodes.values());
}

export function AIThinkingCollapsible({ agentFlowData }: AIThinkingCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!agentFlowData || agentFlowData.length === 0) {
    return null;
  }

  const thinkingNodes = extractThinkingNodes(agentFlowData);

  if (thinkingNodes.length === 0) {
    return null;
  }

  // Get the final reasoning and task (from the last relevant node)
  const lastNode = thinkingNodes[thinkingNodes.length - 1];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50">
        <Brain className="h-3.5 w-3.5" />
        <span>AI Thinking</span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border border-border/50 rounded-md p-3 bg-muted/30 text-xs space-y-3">
          {/* Summary Section - Show final reasoning and task */}
          <div className="space-y-2">
            {lastNode.reasoning && (
              <div>
                <span className="font-medium text-muted-foreground">Reasoning:</span>
                <p className="mt-0.5 text-foreground/80 leading-relaxed">
                  {lastNode.reasoning}
                </p>
              </div>
            )}
            {lastNode.task && (
              <div>
                <span className="font-medium text-muted-foreground">Task:</span>
                <p className="mt-0.5 text-foreground/80 leading-relaxed">
                  {lastNode.task}
                </p>
              </div>
            )}
            {lastNode.next && (
              <div>
                <span className="font-medium text-muted-foreground">Next Worker:</span>
                <span className="ml-1.5 text-foreground/80">{lastNode.next}</span>
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default AIThinkingCollapsible;
