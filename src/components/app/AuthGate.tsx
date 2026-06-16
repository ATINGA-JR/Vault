import { useState, type ReactNode } from "react";
import { useStore, setState, hashPwd } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AuthGate({ children }: { children: ReactNode }) {
  const session = useStore((s) => s.session);
  const user = useStore((s) => s.user);

  if (session) return <>{children}</>;

  return <AuthScreen hasUser={!!user} />;
}

function AuthScreen({ hasUser }: { hasUser: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">(hasUser ? "signin" : "signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      if (!username.trim() || !email.trim() || !password.trim()) {
        toast.error("Please fill all fields");
        return;
      }
      setState((s) => ({
        ...s,
        user: {
          username: username.trim(),
          email: email.trim(),
          passwordHash: hashPwd(password),
          createdAt: new Date().toISOString(),
        },
        session: { username: username.trim() },
      }));
      toast.success(`Welcome, ${username.trim()}.`);
    } else {
      // Sign in
      setState((s) => {
        if (!s.user) {
          toast.error("No account yet — create one first.");
          return s;
        }
        const matches = s.user.email === email.trim() && s.user.passwordHash === hashPwd(password);
        if (!matches) {
          toast.error("Wrong email or password");
          return s;
        }
        toast.success(`Welcome back, ${s.user.username}.`);
        return { ...s, session: { username: s.user.username } };
      });
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-12 md:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground font-serif text-xl">J</div>
          <div>
            <div className="font-serif text-xl leading-none tracking-tight">Jarvis</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Personal OS</div>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight">
            One quiet place<br />for everything<br />you tend to.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Money, tasks, reading, watching, calendar, shopping — held together in one calm, considered space.
          </p>
        </div>

        <div className="flex items-end justify-between text-xs text-muted-foreground">
          <span>Built for one. Yours alone.</span>
          <span className="tabular-nums">v1.0</span>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground font-serif">J</div>
              <span className="font-serif text-xl">Jarvis</span>
            </div>
          </div>

          <h2 className="font-serif text-3xl tracking-tight">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup" ? "A personal workspace, just for you." : "Sign in to continue."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="atinga" autoFocus />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <Button type="submit" className="mt-2 w-full" size="lg">
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className={cn("font-medium text-primary underline-offset-4 hover:underline")}
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </div>

          <p className="mt-10 text-center text-[11px] text-muted-foreground">
            Data is stored locally on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
