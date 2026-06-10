import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

// Create a Supabase client with detectSessionInUrl disabled for manual token handling
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const supabaseNoAutoDetect = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: typeof window !== "undefined" ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Disable auto-detection to manually handle recovery tokens
        flowType: "pkce",
      },
    })
  : null;

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — CampusBazar" },
      { name: "description", content: "Set up or reset your password for CampusBazar." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateRecoveryToken = async () => {
      if (!supabaseNoAutoDetect) {
        console.error("[ResetPassword] Supabase client not available");
        setError("Configuration error. Please contact support.");
        setIsValidating(false);
        return;
      }

      // Log diagnostics IMMEDIATELY on page load
      console.log("[ResetPassword] === PAGE LOAD ===");
      console.log("[ResetPassword] Full URL:", window.location.href);
      console.log("[ResetPassword] Pathname:", window.location.pathname);
      console.log("[ResetPassword] Search (query params):", window.location.search);
      console.log("[ResetPassword] Hash (fragment):", window.location.hash);

      // Capture URL params BEFORE Supabase processes them
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      // Check all possible Supabase recovery formats
      const code = searchParams.get("code") || hashParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type") || searchParams.get("type");
      const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");

      console.log("[ResetPassword] === URL PARAMS ===");
      console.log("[ResetPassword] code:", code ? "present" : "not found");
      console.log("[ResetPassword] access_token:", accessToken ? "present" : "not found");
      console.log("[ResetPassword] refresh_token:", refreshToken ? "present" : "not found");
      console.log("[ResetPassword] type:", type);
      console.log("[ResetPassword] token_hash:", tokenHash ? "present" : "not found");

      // If we have a code, exchange it for a session using the no-auto-detect client
      if (code) {
        console.log("[ResetPassword] Found code parameter, exchanging for session...");
        try {
          const { data: exchangeData, error: exchangeError } = await supabaseNoAutoDetect.auth.exchangeCodeForSession(code);
          console.log("[ResetPassword] exchangeCodeForSession result:", exchangeData);
          console.log("[ResetPassword] exchangeCodeForSession error:", exchangeError);

          if (exchangeError) {
            console.error("[ResetPassword] Code exchange failed:", exchangeError);
            setError("Invalid or expired password reset link. Please request a new one.");
            setIsValidating(false);
            return;
          }

          console.log("[ResetPassword] Code exchange successful, session established");
        } catch (err) {
          console.error("[ResetPassword] Code exchange exception:", err);
          setError("Invalid or expired password reset link. Please request a new one.");
          setIsValidating(false);
          return;
        }
      }

      // Check if we have a valid session after any code exchange
      console.log("[ResetPassword] Checking session...");
      const { data: sessionData, error: sessionError } = await supabaseNoAutoDetect.auth.getSession();
      console.log("[ResetPassword] getSession result:", sessionData);
      console.log("[ResetPassword] getSession error:", sessionError);
      console.log("[ResetPassword] Session exists:", !!sessionData.session);

      if (sessionError) {
        console.error("[ResetPassword] Session check failed:", sessionError);
        setError("Invalid or expired password reset link. Please request a new one.");
        setIsValidating(false);
        return;
      }

      // If we have access_token in URL but no session, try to set it
      if (accessToken && !sessionData.session) {
        console.log("[ResetPassword] Found access_token but no session, setting session...");
        try {
          const { data: setData, error: setSessionError } = await supabaseNoAutoDetect.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          });
          console.log("[ResetPassword] setSession result:", setData);
          console.log("[ResetPassword] setSession error:", setSessionError);

          if (setSessionError) {
            console.error("[ResetPassword] Session set failed:", setSessionError);
            setError("Invalid or expired password reset link. Please request a new one.");
            setIsValidating(false);
            return;
          }

          // Re-check session after setting
          const { data: newSessionData } = await supabaseNoAutoDetect.auth.getSession();
          console.log("[ResetPassword] Session after setSession:", !!newSessionData.session);
        } catch (err) {
          console.error("[ResetPassword] Session set exception:", err);
          setError("Invalid or expired password reset link. Please request a new one.");
          setIsValidating(false);
          return;
        }
      }

      // Final validation: check if we have a valid session
      const { data: finalSessionData } = await supabaseNoAutoDetect.auth.getSession();
      console.log("[ResetPassword] Final session check:", !!finalSessionData.session);

      if (!finalSessionData.session) {
        console.error("[ResetPassword] No valid session found after all attempts");
        setError("Invalid or expired password reset link. Please request a new one.");
      } else {
        console.log("[ResetPassword] === VALIDATION SUCCESSFUL ===");
        // Clean the URL after successful validation
        window.history.replaceState({}, "", "/reset-password");
      }

      setIsValidating(false);
    };

    validateRecoveryToken();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    console.log("[ResetPassword] Attempting to update password");

    try {
      if (!supabaseNoAutoDetect) {
        throw new Error("Supabase client not available");
      }

      // Get current session (should be set from the recovery link)
      const sessionResult = await supabaseNoAutoDetect.auth.getSession();
      const sessionData = sessionResult.data;
      const sessionError = sessionResult.error;
      
      console.log("[ResetPassword] Current session:", !!sessionData?.session);
      console.log("[ResetPassword] Session error:", sessionError);

      if (sessionError) {
        console.error("[ResetPassword] Session error:", sessionError);
        throw sessionError;
      }

      if (!sessionData?.session) {
        console.error("[ResetPassword] No active session found");
        throw new Error("No active session. Please use the link from your email.");
      }

      // Update user password
      const updateResult = await supabaseNoAutoDetect.auth.updateUser({
        password,
      });
      const updateData = updateResult.data;
      const updateError = updateResult.error;

      console.log("[ResetPassword] Update response:", updateData);
      console.log("[ResetPassword] Update error:", updateError);

      if (updateError) {
        console.error("[ResetPassword] Update error:", updateError);
        throw updateError;
      }

      console.log("[ResetPassword] Password updated successfully");
      setSuccess(true);
      toast.success("Password set successfully!");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      console.error("[ResetPassword] Error:", err);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          aria-label="CampusBazar home"
          className="mb-8 flex flex-col items-center justify-center"
        >
          <CampusBazarLogo size="xl" />
          <span className="sr-only">CampusBazar</span>
        </Link>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">
              {success ? "Password Set!" : "Set Your Password"}
            </CardTitle>
            <CardDescription>
              {success
                ? "You can now log in with your email and password."
                : "Create a password to use with your email address."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isValidating ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-center text-muted-foreground">
                  Validating password reset link...
                </p>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center space-y-4 py-8">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <p className="text-center text-muted-foreground">
                  Your password has been set successfully. You can now log in using either Google
                  or your email and password.
                </p>
                <Button onClick={() => navigate({ to: "/login" })} className="w-full">
                  Go to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>{error}</div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      disabled={submitting}
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      disabled={submitting}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitting ? "Setting Password..." : "Set Password"}
                </Button>

                <div className="text-center text-sm">
                  <Link to="/login" className="text-primary hover:underline">
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
