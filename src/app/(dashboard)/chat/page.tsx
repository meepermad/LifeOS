import { getOrCreateActiveThread, listThreadMessages, getPendingProposedAction } from "@/lib/data/assistant";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export default async function ChatPage() {
  const thread = await getOrCreateActiveThread();
  const [messages, pendingAction] = await Promise.all([
    listThreadMessages(thread.id),
    getPendingProposedAction(thread.id),
  ]);

  return (
    <AssistantChat
      initialMessages={messages}
      pendingAction={pendingAction}
      threadId={thread.id}
    />
  );
}
