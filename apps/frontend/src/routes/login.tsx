import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoginMutation } from "@/app/api";
import { errorMessage } from "@/app/base-api";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { signedIn } from "@/features/auth/session.slice";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Tablewise POS" },
      { name: "description", content: "Sign in to your restaurant workspace." },
      { property: "og:title", content: "Sign in — Tablewise POS" },
      { property: "og:description", content: "Sign in to your restaurant workspace." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { hydrated, userId } = useAppSelector((s) => s.session);
  const [login, { isLoading }] = useLoginMutation();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (hydrated && userId) navigate({ to: "/workspace/select", replace: true });
  }, [hydrated, userId, navigate]);

  const onSubmit = async (v: Values) => {
    try {
      const user = await login(v).unwrap();
      dispatch(signedIn(user.id));
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      navigate({ to: "/workspace/select" });
    } catch (e) {
      form.setError("password", { message: errorMessage(e) });
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Use your work email to access your restaurants.">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="name@restaurant.com" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
          {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...form.register("password")} aria-invalid={!!form.formState.errors.password} />
          {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="size-4 animate-spin" />} Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
