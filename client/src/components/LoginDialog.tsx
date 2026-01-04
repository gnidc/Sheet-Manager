import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LogIn, LogOut, Shield } from "lucide-react";

export function LoginDialog() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { isAdmin, login, logout, isLoggingIn, isLoggingOut } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      setOpen(false);
      setUsername("");
      setPassword("");
      toast({ title: "Success", description: "Admin mode activated" });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Invalid credentials", 
        variant: "destructive" 
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged out", description: "Admin mode deactivated" });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Logout failed", 
        variant: "destructive" 
      });
    }
  };

  if (isAdmin) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="gap-2"
        data-testid="button-logout"
      >
        <Shield className="w-4 h-4 text-emerald-500" />
        Admin
        <LogOut className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" data-testid="button-login">
          <LogIn className="w-4 h-4" />
          Login
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Admin Login
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              data-testid="input-username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              data-testid="input-password"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoggingIn}
            data-testid="button-submit-login"
          >
            {isLoggingIn ? "Logging in..." : "Login"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
