import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequestResetMutation } from "@/app/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Tablewise POS" },
      { name: "description", content: "Request a password reset link." },
      { property: "og:title", content: "Reset your password — Tablewise POS" },
      { property: "og:description", content: "Request a password reset link." },
    ],
  }),
  component: ForgotPage,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email") });

function ForgotPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [request, { isLoading }] = useRequestResetMutation();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  return (
    <AuthLayout title="Forgot password" subtitle="We'll email you a link to set a new password.">
      {sent ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border bg-card p-4">
            <MailCheck className="size-5 text-success shrink-0" aria-hidden />
            <div className="space-y-1 text-sm">
              <p>
                If an account exists for <b>{sent}</b>, a password reset link has been dispatched.
              </p>
              {emailSent ? (
                <p className="text-xs text-muted-foreground">
                  An email has been delivered to your address. Please check your inbox and spam folder.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The reset request has been processed securely by the server.
                </p>
              )}
            </div>
          </div>

          {resetToken && (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-medium text-foreground">
                Development / Direct Reset Link:
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/reset-password" search={{ token: resetToken, email: sent }}>
                  Open Reset Password Page <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              const res = await request(v).unwrap();
              setSent(v.email);
              setEmailSent(!!res?.emailSent);
              if (res?.token) {
                setResetToken(res.token);
              }
            } catch (err: any) {
              setSent(v.email);
            }
          })}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@restaurant.com" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" />} Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-muted-foreground underline-offset-4 hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
