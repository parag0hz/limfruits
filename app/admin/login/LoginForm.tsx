"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length === 0) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "로그인에 실패했습니다. 다시 시도해 주세요.");
    } catch {
      setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="admin-password"
            className="text-lg font-bold text-brand-dark"
          >
            비밀번호
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            autoFocus
            autoComplete="current-password"
            enterKeyHint="go"
            placeholder="비밀번호 입력"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "admin-password-error" : undefined}
            className={`w-full rounded-xl border-2 bg-white px-4 py-4 text-xl text-ink placeholder:text-ink/35 focus:outline-none ${
              error
                ? "border-accent-red focus:border-accent-red"
                : "border-brand/35 focus:border-brand"
            }`}
          />
          {error && (
            <p
              id="admin-password-error"
              role="alert"
              className="text-base font-bold text-accent-red"
            >
              {error}
            </p>
          )}
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full text-xl"
        >
          {loading ? "확인 중..." : "로그인"}
        </Button>
      </form>
    </Card>
  );
}
