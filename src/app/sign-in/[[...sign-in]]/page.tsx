import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { isOAuthConfigured } from "@/lib/auth-config";
import styles from "../../login/page.module.css";

export default function SignInPage() {
  return (
    <main className={styles.loginContainer}>
      {isOAuthConfigured() ? (
        <SignIn
          routing="path"
          path="/sign-in"
          forceRedirectUrl="/"
          signUpForceRedirectUrl="/"
        />
      ) : (
        <section className={styles.loginCard}>
          <h1 className={styles.title}>Sign-in needs setup</h1>
          <p className={styles.subtitle}>
            Add the Clerk development keys described in the README, then restart the app.
            Guest image generation still works without an account.
          </p>
          <Link href="/" className={styles.backLink}>
            Return to the generator
          </Link>
        </section>
      )}
    </main>
  );
}
