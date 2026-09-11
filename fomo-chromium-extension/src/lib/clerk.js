import { createClerkClient } from "@clerk/chrome-extension/internal";
import { CLERK_PUBLISHABLE_KEY } from "./config.js";

let clerkPromise;

function clerkErrorMessage(error) {
  const first = error?.errors?.[0];
  return (
    first?.longMessage ||
    first?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

export function toAppUser(clerkUser) {
  if (!clerkUser) return null;
  return {
    id: clerkUser.id,
    email:
      clerkUser.primaryEmailAddress?.emailAddress ||
      clerkUser.emailAddresses?.[0]?.emailAddress ||
      ""
  };
}

export async function getClerk() {
  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing CLERK_PUBLISHABLE_KEY. Add it to fomo-chromium-extension/.env and run npm run build."
    );
  }
  if (!clerkPromise) {
    clerkPromise = (async () => {
      const client = await createClerkClient({
        publishableKey: CLERK_PUBLISHABLE_KEY
      });
      const popupUrl = `${chrome.runtime.getURL(".")}popup.html`;
      await client.load({
        afterSignOutUrl: popupUrl,
        signInForceRedirectUrl: popupUrl,
        signUpForceRedirectUrl: popupUrl,
        allowedRedirectProtocols: ["chrome-extension:"]
      });
      return client;
    })();
  }
  return clerkPromise;
}

export async function getCurrentUser() {
  const clerk = await getClerk();
  return toAppUser(clerk.user);
}

export async function signOut() {
  const clerk = await getClerk();
  await clerk.signOut();
  return { error: null };
}

function emailCodeFactor(signIn) {
  return (signIn.supportedFirstFactors || []).find((factor) => factor.strategy === "email_code");
}

export async function sendLoginOtp(email) {
  const clerk = await getClerk();
  try {
    const signIn = await clerk.client.signIn.create({ identifier: email });
    const factor = emailCodeFactor(signIn);
    if (!factor) {
      return {
        error: {
          message:
            "Email codes are not enabled. In Clerk Dashboard enable Email + OTP (verification code)."
        }
      };
    }
    await signIn.prepareFirstFactor({
      strategy: "email_code",
      emailAddressId: factor.emailAddressId
    });
    return { error: null };
  } catch (error) {
    const message = clerkErrorMessage(error);
    if (/not found|couldn't find|could not find|identifier/i.test(message)) {
      return { error: { message: "No account found for that email. Create an account first." } };
    }
    return { error: { message } };
  }
}

export async function sendSignupOtp(email) {
  const clerk = await getClerk();
  try {
    const signUp = await clerk.client.signUp.create({ emailAddress: email });
    await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    return { error: null };
  } catch (error) {
    const message = clerkErrorMessage(error);
    if (/already|exists|taken/i.test(message)) {
      return { error: { message: "An account with that email already exists. Sign in instead." } };
    }
    return { error: { message } };
  }
}

export async function verifyEmailOtp(code, purpose) {
  const clerk = await getClerk();
  try {
    if (purpose === "signup") {
      const result = await clerk.client.signUp.attemptEmailAddressVerification({ code });
      if (result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
      }
    } else {
      const result = await clerk.client.signIn.attemptFirstFactor({
        strategy: "email_code",
        code
      });
      if (result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
      }
    }
    const user = toAppUser(clerk.user);
    if (!user) {
      return { data: null, error: { message: "Could not start a session. Try the code again." } };
    }
    return { data: { user }, error: null };
  } catch (error) {
    return { data: null, error: { message: clerkErrorMessage(error) } };
  }
}
