import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { bootstrapUserAccount } from "@/lib/supabase-account";
import { checkBanStatus } from "@/lib/ban-enforcement";
import { getSavedLogins, removeSavedLogin, saveLogin, type SavedLogin } from "@/lib/saved-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — CampusBazar" },
      { name: "description", content: "Sign in to CampusBazar, the VIT student marketplace." },
    ],
  }),
  component: LoginPage,
});

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading, isProfileComplete } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [savedLogins, setSavedLogins] = useState<SavedLogin[]>([]);
  const [passwordSetupLoading, setPasswordSetupLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [blockedEmailError, setBlockedEmailError] = useState(false);

  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  const errorCode = params.get("error") || hashParams.get("error");
  const errorDescription = params.get("error_description") || hashParams.get("error_description");

  if (errorCode === "non_vit_email") {
    setBlockedEmailError(true);
    window.history.replaceState({}, "", window.location.pathname);
  } else if (errorCode) {
    // Catches Supabase's own OAuth error redirect, e.g. when the
    // Before-User-Created hook rejects a non-VIT Google account.
    toast.error(errorDescription || "Sign-in was rejected: only VIT email addresses are allowed.");
    setBlockedEmailError(true);
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);

  useEffect(() => {
    setSavedLogins(getSavedLogins());
  }, []);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: isProfileComplete ? "/" : "/complete-profile" });
    }
  }, [loading, session, isProfileComplete, navigate]);

  const navigateAfterAuth = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      await bootstrapUserAccount(authUser);
      const banStatus = await checkBanStatus(authUser.id);
      if (banStatus.isBanned) {
        toast.error(
          banStatus.isPermanent
            ? "Your account has been permanently banned."
            : `Your account is banned until ${new Date(banStatus.bannedUntil!).toLocaleDateString()}.`,
        );
        navigate({ to: "/banned" as any });
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_profile_complete")
        .eq("id", authUser.id)
        .maybeSingle();
      navigate({ to: prof?.is_profile_complete ? "/" : "/complete-profile" });
    } else {
      navigate({ to: "/" });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!email.endsWith("@vitstudent.ac.in") && !email.endsWith("@vit.ac.in")) {
        toast.error("Only VIT email addresses are allowed.");
        return;
      }
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (rememberMe) {
          saveLogin({ email, displayName: fullName || undefined, provider: "email" });
        }
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        saveLogin({ email, displayName: fullName, provider: "email" });
        toast.success("Account created!");
      }
      await navigateAfterAuth();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (savedEmail?: string) => {
  setGoogleLoading(true);
  try {
    const options: Record<string, unknown> = {
      redirectTo: `${window.location.origin}/login`,
    };
    if (savedEmail) options.queryParams = { login_hint: savedEmail };

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options,
    });

    if (error) throw error;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Google sign-in failed");
  } finally {
    setGoogleLoading(false);
  }
};

  const applySavedLogin = (saved: SavedLogin) => {
    if (saved.provider === "google") {
      void handleGoogle(saved.email);
      return;
    }
    setMode("signin");
    setEmail(saved.email);
    if (saved.displayName) setFullName(saved.displayName);
    toast.message(`Welcome back! Enter your password for ${saved.email}`);
  };

  const dismissSavedLogin = (saved: SavedLogin, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSavedLogin(saved.email);
    setSavedLogins(getSavedLogins());
  };

  const handlePasswordSetup = async (email: string) => {
    setPasswordSetupLoading(true);
    console.log("[PasswordSetup] Initiating password setup for:", email);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      console.log("[PasswordSetup] Redirect URL:", redirectTo);

      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      console.log("[PasswordSetup] resetPasswordForEmail response:", data);
      console.log("[PasswordSetup] resetPasswordForEmail error:", error);

      if (error) {
        console.error("[PasswordSetup] Error sending password reset email:", error);
        throw error;
      }

      console.log("[PasswordSetup] Password reset email sent successfully");
      toast.success("Password setup email sent! Check your inbox.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send password setup email";
      console.error("[PasswordSetup] Error:", err);
      toast.error(message);
    } finally {
      setPasswordSetupLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    console.log("[ForgotPassword] Initiating password reset for:", forgotPasswordEmail);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      console.log("[ForgotPassword] Redirect URL:", redirectTo);

      const { data, error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo,
      });

      console.log("[ForgotPassword] resetPasswordForEmail response:", data);
      console.log("[ForgotPassword] resetPasswordForEmail error:", error);

      if (error) {
        console.error("[ForgotPassword] Error sending password reset email:", error);
        throw error;
      }

      console.log("[ForgotPassword] Password reset email sent successfully");
      toast.success("Password reset email sent! Check your inbox.");
      setForgotPasswordMode(false);
      setForgotPasswordEmail("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send password reset email";
      console.error("[ForgotPassword] Error:", err);
      toast.error(message);
    } finally {
      setForgotPasswordLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          aria-label="CampusBazar home"
          className="mb-8 flex flex-col items-center justify-center gap-3"
        >
          <CampusBazarLogo size="xl" />
          <span className="sr-only">CampusBazar</span>
        </Link>

        {savedLogins.length > 0 && (
          <Card className="mb-4 border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Continue with saved account</CardTitle>
              <CardDescription>
                Pick an account you&apos;ve used before on this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {savedLogins.map((saved) => (
                <div
                  key={saved.email}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <button
                    type="button"
                    onClick={() => applySavedLogin(saved)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {saved.email.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {saved.displayName ?? saved.email.split("@")[0]}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{saved.email}</div>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                      {saved.provider === "google" ? "Google" : "Email"}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove saved account"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={(e) => dismissSavedLogin(saved, e)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {savedLogins.some((l) => l.provider === "google") && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                  <p className="mb-2 text-sm font-medium text-primary">
                    Signed up with Google? Set up a password
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const googleLogin = savedLogins.find((l) => l.provider === "google");
                      if (googleLogin) {
                        handlePasswordSetup(googleLogin.email);
                      }
                    }}
                    disabled={passwordSetupLoading}
                  >
                    {passwordSetupLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Set up password
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">
              {forgotPasswordMode ? "Reset Password" : mode === "signin" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {forgotPasswordMode
                ? "Enter your email to receive a password reset link"
                : "Use your VIT student email (@vitstudent.ac.in)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {forgotPasswordMode ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Email</Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="you@vitstudent.ac.in"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={forgotPasswordLoading}>
                  {forgotPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setForgotPasswordEmail("");
                  }}
                >
                  Back to Login
                </Button>
              </form>
            ) : (
              <>
              {blockedEmailError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>Access denied.</strong> This platform is only available to VIT students.
                    Please sign in with your @vitstudent.ac.in or @vit.ac.in email address.
                  </AlertDescription>
                </Alert>
              )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleGoogle()}
                  disabled={googleLoading || submitting}
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon className="h-5 w-5" />
                  )}
                  Continue with Google
                </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or use email</span>
              </div>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <TabsContent value="signup" className="m-0 space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Aditi Sharma"
                    required={mode === "signup"}
                  />
                </TabsContent>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@vitstudent.ac.in"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setForgotPasswordMode(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                {mode === "signin" && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(v) => setRememberMe(Boolean(v))}
                    />
                    <Label htmlFor="rememberMe" className="text-sm font-normal">
                      Remember me on this device
                    </Label>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={submitting || googleLoading}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
            </Tabs>
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
