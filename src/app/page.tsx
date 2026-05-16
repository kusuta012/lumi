import { isSetupComplete } from "@/server/queries/setup";
import { redirect, RedirectType } from "next/navigation";

export default async function Home() {
  const setupDone = await isSetupComplete();

  if (!setupDone) {
    redirect("/setup");
  } else {
    redirect("/login");
  }
  return null;
}