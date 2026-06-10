"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo iniciar sesión");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh">
      {/* Brand panel — hidden on small screens */}
      <aside className="hidden w-[44%] flex-col justify-between bg-gradient-to-br from-primary to-[#14275C] p-12 lg:flex" aria-hidden="true">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500">
            <Plane className="h-6 w-6 text-[#14275C]" aria-hidden="true" />
          </div>
          <span className="font-heading text-xl font-bold text-white">
            AeroReserva
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <p className="font-heading text-4xl font-semibold leading-tight text-white">
            Gestión de reservas para profesionales
          </p>
          <p className="max-w-md text-base leading-relaxed text-slate-300">
            Controlá vuelos, asientos, pasajeros y la lista de espera desde un
            solo lugar — con la base de datos garantizando cada reserva.
          </p>
        </div>

        <p className="font-mono text-xs text-slate-400">
          AeroReserva · sistema interno de operadores
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          {/* Logo shown only when the brand panel is hidden */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500">
              <Plane className="h-5 w-5 text-[#14275C]" aria-hidden="true" />
            </div>
            <span className="font-heading text-lg font-bold text-foreground">
              AeroReserva
            </span>
          </div>

          <div className="mb-6">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              Bienvenido
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresá con tu usuario de operador.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
