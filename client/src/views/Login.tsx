import React, { useState } from "react";
import { useAuth } from "../hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LogIn, Github, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const { login, signup, isLoggingIn, isSigningUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login({ email, password });
        toast.success("Welcome back!");
      } else {
        await signup({ email, password, name });
        toast.success("Account created successfully!");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Authentication failed");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:3000/auth/google";
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-4 grain-overlay">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet/20 flex items-center justify-center border border-violet/30 shadow-lg shadow-violet/10">
            <div className="w-8 h-8 rounded-xl bg-violet shadow-lg shadow-violet/50 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              VPSHub
            </h1>
            <p className="text-muted-foreground text-sm">
              Next-Gen VPS Management
            </p>
          </div>
        </div>

        <Card className="border-border/40 bg-card/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>{isLogin ? "Welcome Back" : "Create Account"}</CardTitle>
            <CardDescription>
              {isLogin
                ? "Enter your credentials to access your dashboard"
                : "Enter your details to start managing your servers"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-dark/50 border-border/40 focus:border-violet/50 transition-colors"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Mail className="absolute mt-9 ml-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-dark/50 border-border/40 focus:border-violet/50 transition-colors"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <ShieldAlert className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-dark/50 border-border/40 focus:border-violet/50 transition-colors"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-violet hover:bg-violet/90 text-white shadow-lg shadow-violet/20 h-10 transition-all active:scale-[0.98]"
                disabled={isLoggingIn || isSigningUp}
              >
                {isLoggingIn || isSigningUp ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    <span>{isLogin ? "Sign In" : "Sign Up"}</span>
                  </div>
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="border-border/40 hover:bg-foreground/5 transition-colors"
                onClick={handleGoogleLogin}
              >
                <Mail className="mr-2 h-4 w-4" />
                Google
              </Button>
              <Button
                variant="outline"
                className="border-border/40 hover:bg-foreground/5 transition-colors"
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border/10 pt-4">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-violet hover:text-violet/80 transition-colors underline-offset-4 hover:underline"
            >
              {isLogin
                ? "Don't have an account? Sign Up"
                : "Already have an account? Sign In"}
            </button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
