import { Clerk } from "@clerk/clerk-js";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY. Add your key to .env.local.\nRun: 1) clerk auth login  2) clerk link  3) clerk env pull — then restart the dev server.");
}

const clerk = new Clerk(publishableKey);
await clerk.load();

if (clerk.user) {
  const div = document.getElementById("app");
  div.innerHTML = '<div id="user-button"></div>';
  clerk.mountUserButton(document.getElementById("user-button"));
} else {
  const div = document.getElementById("app");
  div.innerHTML = `
    <main id="auth-layout">
      <section>
        <p class="eyebrow">FOMO</p>
        <h1>University, together.</h1>
        <p>Sign in or create an account to continue.</p>
      </section>
      <div class="auth-actions">
        <div id="sign-in"></div>
        <div id="sign-up"></div>
      </div>
    </main>`;
  clerk.mountSignIn(document.getElementById("sign-in"));
  clerk.mountSignUp(document.getElementById("sign-up"));
}
