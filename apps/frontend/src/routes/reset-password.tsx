import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPasswordMutation } from "@/app/api";
import { validateResetToken } from "@/services/platform.service";

const resetSearchSchema = z.object({
  token: z.string().optional().default(""),
  email: z.string().optional().default(""),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search) => resetSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Set a new password — Tablewise POS" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set a new password — Tablewise POS" },
      { property: "og:description", content: "Choose a new password for your account." },
    ],
  }),
  component: ResetPage,
});

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

function ResetPage() {
  const navigate = useNavigate();
  const { token, email } = Route.useSearch();
  const [isValidating, setIsValidating] = useState<boolean>(!!token);
  const [tokenError, setTokenError] = useState<string | null>(
    !token ? "Missing password reset token. Please request a new link." : null
  );
  const [tokenValid, setTokenValid] = useState<boolean>(false);
  const [resetPassword, { isLoading: isSubmitting }] = useResetPasswordMutation();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    setIsValidating(true);

    validateResetToken(token)
      .then((res) => {
        if (!mounted) return;
        if (res.valid) {
          setTokenValid(true);
          setTokenError(null);
        } else {
          setTokenError("Password reset link is invalid or expired.");
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setTokenError(
          err?.message || "Password reset link is invalid, expired, or has already been used."
        );
      })
      .finally(() => {
        if (mounted) setIsValidating(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const onSubmit = async (v: z.infer<typeof schema>) => {
    try {
      const res = await resetPassword({
        token,
        newPassword: v.password,
      }).unwrap();

      toast.success(res?.message || "Password updated successfully. Please sign in.");
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password. Please try again.");
    }
  };

  const e = form.formState.errors;

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={email ? `For account: ${email}` : "Choose a new password for your account."}
    >
      {isValidating ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Validating reset link...</p>
        </div>
      ) : tokenError ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Reset link error</p>
              <p className="mt-1 text-xs opacity-90">{tokenError}</p>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request a new reset link</Link>
          </Button>
        </div>
      ) : (
        <form noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...form.register("password")}
            />
            {e.password && <p className="text-xs text-destructive">{e.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...form.register("confirm")}
            />
            {e.confirm && <p className="text-xs text-destructive">{e.confirm.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
            Update password
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
