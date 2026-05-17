import { isSetupComplete } from "@/server/queries/setup";
import { redirect, RedirectType } from "next/navigation";
import { auth } from "@/server/auth"
 
export default async function Home() {
  const setupDone = await isSetupComplete();

  if (!setupDone) {
    redirect("/setup");
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/photos");
  }

  redirect("/login");
}