import { redirect } from "next/navigation";
import { getAuthenticatedUser, isAllowedEmail } from "@/lib/auth/authorize-user";

export default async function HomePage() {
  const user = await getAuthenticatedUser();

  if (user && isAllowedEmail(user.email)) {
    redirect("/today");
  }

  redirect("/login");
}
