import { AssistantChat } from "@/components/assistant/assistant-chat";
import {
  getActionPreviewById,
  getOrCreateActiveThread,
  getPendingProposedAction,
  listThreadMessages,
} from "@/lib/data/assistant";

type Props = {
  searchParams: Promise<{ action?: string }>;
};

export default async function ChatPage({ searchParams }: Props) {
  const params = await searchParams;
  const thread = await getOrCreateActiveThread();
  const [messages, pendingFromThread, pendingFromLink] = await Promise.all([
    listThreadMessages(thread.id),
    getPendingProposedAction(thread.id),
    params.action ? getActionPreviewById(params.action) : Promise.resolve(null),
  ]);

  const pendingAction = pendingFromLink ?? pendingFromThread;

  return (
    <AssistantChat
      initialMessages={messages}
      pendingAction={pendingAction}
      threadId={thread.id}
    />
  );
}
