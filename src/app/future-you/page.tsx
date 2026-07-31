import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getFutureYouHistory } from "@/server/conversation";
import { FutureYouChat } from "@/components/phoenix/future-you-chat";

export const metadata = { title: "Future You" };

// Top-level (outside the tabbed app shell) so the conversation is immersive —
// no bottom nav competing with the composer.
export default async function FutureYouPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/future-you");

  const history = await getFutureYouHistory();
  return <FutureYouChat initial={history} />;
}
