import { SignOutButton, UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isOAuthConfigured } from "@/lib/auth-config";
import styles from "../login/page.module.css";

export default async function AccountPage() {
  if (!isOAuthConfigured()) redirect("/sign-in");

  const session = await auth();
  if (!session.userId) redirect("/sign-in");

  return (
    <main className={styles.loginContainer}>
      <div>
        <UserProfile routing="hash" />
        <div className={styles.loginCard}>
          <SignOutButton redirectUrl="/">
            <button type="button" className={styles.logoutBtn}>Sign out</button>
          </SignOutButton>
          <Link href="/" className={styles.backLink}>
            Return to the generator
          </Link>
        </div>
      </div>
    </main>
  );
}
