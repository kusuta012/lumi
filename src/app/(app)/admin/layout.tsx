import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user || session.user.roleName !== "Super Admin") {
        console.warn(`get out of here, this is not meant for you kid /silly`)
        redirect("/photos");
    }
    return <>{children}</>
}