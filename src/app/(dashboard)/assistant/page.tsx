import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ action?: string }>;
};

export default async function AssistantPage({ searchParams }: Props) {
  const params = await searchParams;
  const action = params.action;
  redirect(action ? `/chat?action=${encodeURIComponent(action)}` : "/chat");
}
