export interface AIUserContext {
    user_id: string;
    employee_id?: string;
    role: string;
    branch_id?: string;
    hospital_id?: string;
    username: string;
}

export interface AIChatRequest {
    message: string;
    conversationId?: string;
    navRoutes?: Record<string, string>;
}

export interface AIChatResponse {
    success: boolean;
    message: string;
    conversationId: string;
    performedActions: AIPerformedAction[];
}

export interface AIPerformedAction {
    tool: string;
    description: string;
    success: boolean;
    result?: any;
    error?: string;
}

export interface AIConversationMessage {
    role: "user" | "assistant" | "system" | "tool";
    content: string | null;
    tool_calls?: AIToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface AIToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export interface AIToolResult {
    tool_call_id: string;
    output: any;
}

export interface AIPendingConfirmation {
    toolName: string;
    args: any;
    userId: string;
    expiresAt: number;
}

export type AIToolCategory = "READ" | "WRITE" | "DESTRUCTIVE";
