import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/config/permissions.config";
import { useAppDispatch } from "@/app/hooks";
import { signedIn } from "@/features/auth/session.slice";
import { acceptInvite, getInviteDetails, type InviteDetails } from "@/services/people.service";

const inviteSearchSchema = z.object({
  token: z.string().optional().default(""),
});

export const Route = createFileRoute("/invite")({
  validateSearch: (search) => inviteSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Accept invitation — Tablewise POS" },
      { name: "description", content: "Join your restaurant team on Tablewise POS." },
      { property: "og:title", content: "Accept invitation — Tablewise POS" },
      { property: "og:description", content: "Join your restaurant team on Tablewise POS." },
    ],
  }),
  component: InvitePage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  password: z.string().min(6, "At least 6 characters"),
});

function InvitePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token } = Route.useSearch();
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(!!token);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "" },
  });

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    getInviteDetails(token)
      .then((d) => {
        setDetails(d);
        if (d.name) {
          form.setValue("name", d.name);
        }
      })
      .catch((err: any) => {
        setError(err?.message || "Invalid or expired invitation link.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token, form]);

  const subtitle = details
    ? `${details.tenantName} invited you to join as ${ROLE_LABELS[details.role] || details.role}.`
    : "Join your restaurant team on Tablewise POS.";

  const e = form.formState.errors;

  return (
    <AuthLayout title="You're invited" subtitle={subtitle}>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mb-2" />
          <p className="text-sm">Loading invitation details...</p>
        </div>
      ) : error ? (
        <div className="space-y-4 text-center">
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            setIsSubmitting(true);
            try {
              if (token) {
                const res = await acceptInvite({ token, password: v.password, name: v.name });
                if (res?.user) {
                  dispatch(signedIn(res.user.id));
                  toast.success(`Welcome aboard, ${v.name}! Opening your workspace...`);
                  const targetSlug = res.tenantSlug || details?.tenantSlug || "saffron-ember";
                  navigate({
                    to: "/app/$tenantSlug",
                    params: { tenantSlug: targetSlug },
                  });
                  return;
                }
              }
              toast.success(`Welcome aboard, ${v.name}! Your account is now active.`);
              navigate({ to: "/login" });
            } catch (err: any) {
              toast.error(err?.message || "Could not accept invitation.");
            } finally {
              setIsSubmitting(false);
            }
          })}
        >

          {details?.email && (
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input value={details.email} disabled className="bg-muted text-muted-foreground" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" {...form.register("name")} />
            {e.name && <p className="text-xs text-destructive">{e.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Create password</Label>
            <Input id="password" type="password" {...form.register("password")} placeholder="Choose a secure password" />
            {e.password && <p className="text-xs text-destructive">{e.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
            Accept invitation & activate account
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          I already have an account
        </Link>
      </p>
    </AuthLayout>
  );
}
