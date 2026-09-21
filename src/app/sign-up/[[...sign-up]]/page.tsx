import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { isOAuthConfigured } from "@/lib/auth-config";
import styles from "../../login/page.module.css";

export default function SignUpPage() {
  return (
    <main className={styles.loginContainer}>
      {isOAuthConfigured() ? (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          oauthFlow="redirect"
          forceRedirectUrl="/"
          signInForceRedirectUrl="/"
        />
      ) : (
        <section className={styles.loginCard}>
          <h1 className={styles.title}>Sign-up needs setup</h1>
          <p className={styles.subtitle}>
            Add the Clerk keys described in the README, then restart the app. Guest image
            generation still works without an account.
          </p>
          <Link href="/" className={styles.backLink}>
            Return to the generator
          </Link>
        </section>
      )}
    </main>
  );
}
