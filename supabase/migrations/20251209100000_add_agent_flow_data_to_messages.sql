-- Migration: Add agent_flow_data column to messages table
-- Purpose: Store Flowise agentFlowExecutedData for AI transparency/governance
-- This enables Admin and Member users to see how AI "thinks" when responding

-- Add JSONB column to store the agentFlowExecutedData array from Flowise
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS agent_flow_data JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.agent_flow_data IS
'Stores Flowise agentFlowExecutedData array containing reasoning, task, and node execution details for AI governance/transparency';
