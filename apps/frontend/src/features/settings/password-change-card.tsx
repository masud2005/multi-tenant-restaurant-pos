import { useState } from "react";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Lock } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function PasswordChangeCard() {
  const { user, role } = useTenant();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      // Interactive frontend demonstration
      await new Promise((resolve) => setTimeout(resolve, 600));
      toast.success("Security credentials updated! Your password has been changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="size-4 text-primary" /> Account Security & Password
            </CardTitle>
            <CardDescription>
              Update your staff login credentials and secure your account access.
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1.5 self-start sm:self-auto py-1 px-2.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="capitalize">{role}</span> Access Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Profile Strip */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-lg bg-muted/40 border">
          <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
            {user.initials || "U"}
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <Badge variant="secondary" className="font-mono text-xs uppercase shrink-0">
            {role}
          </Badge>
        </div>

        {/* Password Form */}
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5">
                <Check
                  className={`size-3.5 ${
                    newPassword.length >= 8 ? "text-emerald-500" : "text-muted-foreground"
                  }`}
                />
                <span>At least 8 characters long</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check
                  className={`size-3.5 ${
                    newPassword && newPassword === confirmPassword
                      ? "text-emerald-500"
                      : "text-muted-foreground"
                  }`}
                />
                <span>Passwords match</span>
              </div>
            </div>

            <Button type="submit" disabled={updatingPassword} className="gap-2">
              <Lock className="size-4" />
              {updatingPassword ? "Updating Password..." : "Update Password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
