"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  MailPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { SecretField } from "@/components/account/access-key-field";
import { RequireUser } from "@/components/auth/require-user";
import { inputClass, segmentClass } from "@/components/ui/form";
import { Crosshairs } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { ago, timeUntil } from "@/lib/client/format";
import { useSession } from "@/lib/client/session";
import type { AdminUser, Invite, Role } from "@/lib/types";

export default function AdminPage() {
  return (
    <RequireUser title="admin panel">
      <AdminGate />
    </RequireUser>
  );
}

function AdminGate() {
  const { session, user } = useSession();
  if (session?.testMode || user?.role !== "admin") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <ShieldCheck className="text-muted size-8" />
        <h1 className="display mt-5 text-[28px]">
          Admins <b>only</b>
        </h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          {session?.testMode
            ? "Roles, access keys and invites are stored in the database, so the admin panel needs TEST_MODE=off."
            : "Your account doesn't have admin access. Ask an admin to change your role."}
        </p>
        <Link href="/explore" className="btn-secondary mt-6">
          Back to Explore
        </Link>
      </div>
    );
  }
  return <AdminPanel />;
}

const roleLabel = (role: Role) => (role === "admin" ? "Admin" : "User");
const displayName = (u: Pick<AdminUser, "name" | "username" | "email">) => u.name || (u.username ? `@${u.username}` : u.email) || "Unnamed";

function AdminPanel() {
  const [tab, setTab] = useState<"users" | "invites">("users");
  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api<{ items: AdminUser[] }>("/api/admin/users").then((r) => r.items),
  });
  const invites = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => api<{ items: Invite[] }>("/api/admin/invites").then((r) => r.items),
  });

  const stats = [
    { label: "Users", value: users.data?.length },
    { label: "Admins", value: users.data?.filter((u) => u.role === "admin").length },
    { label: "Active access keys", value: users.data?.filter((u) => u.hasAccessKey && !u.disabled).length },
    { label: "Pending invites", value: invites.data?.filter((i) => i.status === "pending").length },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[34px] sm:text-[44px]">
            Admin <b>panel</b>
          </h1>
          <p className="text-muted mt-3 max-w-2xl text-[15px]">
            ViralLens is invite-only. Add people with an access key (email optional) or send them a single-use invite link.
          </p>
        </div>
      </div>

      <dl className="border-border mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-[var(--border)] lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface min-w-0 px-4 py-4">
            <dd className="text-[24px] font-semibold tabular-nums">{s.value ?? "—"}</dd>
            <dt className="text-muted truncate text-[12.5px]">{s.label}</dt>
          </div>
        ))}
      </dl>

      <div className="border-border mt-8 inline-grid grid-cols-2 rounded-md border p-1">
        <button type="button" onClick={() => setTab("users")} className={segmentClass(tab === "users")}>
          <Users className="size-3.5" /> Users & keys
        </button>
        <button type="button" onClick={() => setTab("invites")} className={segmentClass(tab === "invites")}>
          <Link2 className="size-3.5" /> Invite links
        </button>
      </div>

      {tab === "users" ? (
        <div className="mt-6 space-y-6">
          <AddUserPanel />
          <UsersList users={users.data} loading={users.isLoading} error={users.error?.message} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <CreateInvitePanel />
          <InvitesList invites={invites.data} loading={invites.isLoading} error={invites.error?.message} />
        </div>
      )}
    </div>
  );
}

function Panel({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="border-border bg-surface relative border">
      <Crosshairs />
      <header className="border-border flex items-start gap-3 border-b px-4 py-4 sm:px-6">
        <span className="border-border bg-background text-accent grid size-9 shrink-0 place-items-center rounded-md border">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-muted mt-0.5 text-[13px]">{description}</p>
        </div>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function RolePicker({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <div className="border-border grid h-11 shrink-0 grid-cols-2 rounded-md border p-1" role="radiogroup" aria-label="Role">
      {(["user", "admin"] as const).map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          onClick={() => onChange(role)}
          className={segmentClass(value === role)}
        >
          {roleLabel(role)}
        </button>
      ))}
    </div>
  );
}

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin"] });
}

function AddUserPanel() {
  const invalidate = useInvalidateAdmin();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [created, setCreated] = useState<{ user: AdminUser; accessKey: string } | null>(null);

  const add = useMutation({
    mutationFn: () =>
      api<{ user: AdminUser; accessKey: string }>("/api/admin/users", { method: "POST", json: { name, username, email, role } }),
    onSuccess: (result) => {
      setCreated(result);
      setName("");
      setUsername("");
      setEmail("");
      setRole("user");
      invalidate();
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };

  return (
    <Panel
      title="Add user with an access key"
      description="Only a name is needed. They sign in with the generated 6-digit key — add their email to also let them use Continue with Google."
      icon={<UserPlus className="size-4" />}
    >
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto_auto]">
        <input className={inputClass} placeholder="Name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className={inputClass}
          placeholder="Username (optional)"
          aria-label="Username"
          pattern="[A-Za-z0-9_.]{3,32}"
          title="3–32 characters: letters, numbers, _ or ."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={inputClass}
          type="email"
          placeholder="Email (optional)"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <RolePicker value={role} onChange={setRole} />
        <button disabled={add.isPending || (!name.trim() && !username.trim())} className="btn-primary h-11 whitespace-nowrap">
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Generate key
        </button>
      </form>
      {add.isError && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {add.error.message}
        </p>
      )}
      {created && (
        <div className="border-accent/40 bg-accent/[0.06] mt-4 rounded-md border p-4" aria-live="polite">
          <p className="flex items-center gap-2 text-[14px] font-medium">
            <CheckCircle2 className="text-accent size-4" /> {displayName(created.user)} was added as{" "}
            {roleLabel(created.user.role).toLowerCase()}
          </p>
          <SecretField className="mt-3" value={created.accessKey} defaultRevealed />
          <p className="text-muted mt-2 text-[12.5px]">
            Share this key privately. They sign in at <span className="text-foreground">/login → Access key</span>. You can view or
            regenerate it any time in the list below.
          </p>
        </div>
      )}
    </Panel>
  );
}

function UsersList({ users, loading, error }: { users?: AdminUser[]; loading: boolean; error?: string }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users ?? [];
    return (users ?? []).filter((u) => [u.name, u.username, u.email, u.id].some((v) => v?.toLowerCase().includes(needle)));
  }, [users, query]);

  return (
    <section className="border-border bg-surface relative border">
      <Crosshairs />
      <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold">
          All users <span className="text-muted font-normal">{users ? `· ${users.length}` : ""}</span>
        </h2>
        <label className="relative w-full sm:w-72">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            className={`${inputClass} h-10 pl-9`}
            placeholder="Search name, username, email"
            aria-label="Search users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      <div className="text-muted border-border hidden grid-cols-[minmax(0,1.3fr)_110px_minmax(0,1.5fr)_110px_auto] gap-4 border-b px-6 py-2.5 text-[11.5px] font-medium tracking-wide uppercase lg:grid">
        <span>User</span>
        <span>Role</span>
        <span>Access key</span>
        <span>Last sign-in</span>
        <span className="w-[228px] text-right">Actions</span>
      </div>

      {loading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton h-14 rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="p-6 text-sm text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted p-10 text-center text-sm">{query ? "No users match your search." : "No users yet."}</p>
      ) : (
        <ul className="divide-border divide-y">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </ul>
      )}
    </section>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const { user: me } = useSession();
  const invalidate = useInvalidateAdmin();
  const isMe = me?.id === user.id;
  const [message, setMessage] = useState<string | null>(null);

  const patch = useMutation({
    mutationFn: (data: { role?: Role; disabled?: boolean }) => api(`/api/admin/users/${user.id}`, { method: "PATCH", json: data }),
    onSuccess: () => invalidate(),
    onError: (error) => setMessage(error.message),
  });
  const regenerate = useMutation({
    mutationFn: () => api<{ accessKey: string }>(`/api/admin/users/${user.id}/access-key`, { method: "POST" }),
    onSuccess: () => {
      setMessage(
        isMe
          ? "New key generated. Your other devices were signed out; this browser stays signed in."
          : "New key generated. The old key no longer works and they were signed out everywhere.",
      );
      invalidate();
    },
    onError: (error) => setMessage(error.message),
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/admin/users/${user.id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
    onError: (error) => setMessage(error.message),
  });
  const busy = patch.isPending || regenerate.isPending || remove.isPending;

  return (
    <li className={`px-4 py-4 sm:px-6 ${user.disabled ? "opacity-60" : ""}`}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_110px_minmax(0,1.5fr)_110px_auto] lg:items-center lg:gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-[14px] font-medium">
            <span className="truncate">{displayName(user)}</span>
            {isMe && <span className="border-border text-muted shrink-0 rounded border px-1.5 text-[10.5px]">You</span>}
            {user.disabled && <span className="shrink-0 rounded border border-red-500/40 px-1.5 text-[10.5px] text-red-400">Disabled</span>}
          </p>
          <p className="text-muted truncate text-[12.5px]">
            {[
              user.username && `@${user.username}`,
              user.email ?? "No email",
              user.googleLinked ? "Google + key" : user.email ? "Google (not yet used) + key" : "key only",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex items-center gap-2 lg:block">
          <span className="text-muted w-20 text-[12px] lg:hidden">Role</span>
          <select
            aria-label={`Role for ${displayName(user)}`}
            value={user.role}
            disabled={busy || isMe}
            onChange={(e) => patch.mutate({ role: e.target.value as Role })}
            className="border-border bg-background h-9 rounded-md border px-2.5 text-[13px] disabled:opacity-60"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="min-w-0">
          <SecretField value={user.accessKey} placeholder={user.hasAccessKey ? "Can't display — regenerate" : "No key yet"} />
          {user.accessKeyCreatedAt && <p className="text-muted mt-1 text-[11.5px]">Created {ago(user.accessKeyCreatedAt)}</p>}
        </div>

        <p className="text-muted text-[12.5px]">
          <span className="lg:hidden">Last sign-in: </span>
          {user.lastLoginAt ? `${ago(user.lastLoginAt)}` : "Never"}
        </p>

        <div className="flex flex-wrap items-center gap-2 lg:w-[228px] lg:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              confirm(
                `Regenerate the access key for ${displayName(user)}?\n\nThe current key stops working and they are signed out on every device.`,
              ) && regenerate.mutate()
            }
            className="btn-secondary h-9 px-3 whitespace-nowrap"
          >
            {regenerate.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {user.hasAccessKey ? "Regenerate" : "Generate"}
          </button>
          <button
            type="button"
            disabled={busy || isMe}
            onClick={() => patch.mutate({ disabled: !user.disabled })}
            title={user.disabled ? "Enable account" : "Disable account (signs them out)"}
            aria-label={user.disabled ? `Enable ${displayName(user)}` : `Disable ${displayName(user)}`}
            className="border-border text-muted hover:text-foreground grid size-9 place-items-center rounded-md border transition disabled:opacity-40"
          >
            {user.disabled ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}
          </button>
          <button
            type="button"
            disabled={busy || isMe}
            onClick={() => confirm(`Delete ${displayName(user)} and all their boards, alerts and creators?`) && remove.mutate()}
            title="Delete user"
            aria-label={`Delete ${displayName(user)}`}
            className="border-border text-muted grid size-9 place-items-center rounded-md border transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {message && (
        <p className="text-muted mt-2 text-[12.5px]" aria-live="polite">
          {message}
        </p>
      )}
    </li>
  );
}

function CreateInvitePanel() {
  const invalidate = useInvalidateAdmin();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [days, setDays] = useState(7);
  const [link, setLink] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<{ invite: Invite; link: string }>("/api/admin/invites", { method: "POST", json: { email, name, role, expiresInDays: days } }),
    onSuccess: (result) => {
      setLink(result.link);
      setEmail("");
      setName("");
      invalidate();
    },
  });

  return (
    <Panel
      title="Create an invite link"
      description="A single-use sign-up link. The person joins with Google (tie it to an email to restrict which account) and gets an access key too."
      icon={<MailPlus className="size-4" />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_auto_auto_auto]"
      >
        <input
          className={inputClass}
          placeholder="Name (optional)"
          aria-label="Invitee name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={inputClass}
          type="email"
          placeholder="Email (optional)"
          aria-label="Invitee email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <RolePicker value={role} onChange={setRole} />
        <select
          aria-label="Link expires after"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border-border bg-background h-11 rounded-md border px-3 text-[13px]"
        >
          <option value={1}>Expires in 1 day</option>
          <option value={7}>Expires in 7 days</option>
          <option value={30}>Expires in 30 days</option>
        </select>
        <button disabled={create.isPending} className="btn-primary h-11 whitespace-nowrap">
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Create link
        </button>
      </form>
      {create.isError && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {create.error.message}
        </p>
      )}
      {link && (
        <div className="border-accent/40 bg-accent/[0.06] mt-4 rounded-md border p-4" aria-live="polite">
          <p className="flex items-center gap-2 text-[14px] font-medium">
            <CheckCircle2 className="text-accent size-4" /> Invite link ready
          </p>
          <SecretField className="mt-3" value={link} label="invite link" defaultRevealed />
          <p className="text-muted mt-2 text-[12.5px]">Anyone with this link can create one account, so share it privately.</p>
        </div>
      )}
    </Panel>
  );
}

const STATUS_STYLE: Record<Invite["status"], string> = {
  pending: "border-accent/40 text-accent",
  used: "border-border text-muted",
  expired: "border-red-500/40 text-red-400",
};

function InvitesList({ invites, loading, error }: { invites?: Invite[]; loading: boolean; error?: string }) {
  const invalidate = useInvalidateAdmin();
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/admin/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });

  return (
    <section className="border-border bg-surface relative border">
      <Crosshairs />
      <header className="border-border border-b px-4 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold">
          Invite links <span className="text-muted font-normal">{invites ? `· ${invites.length}` : ""}</span>
        </h2>
      </header>
      {loading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="skeleton h-14 rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="p-6 text-sm text-red-400">{error}</p>
      ) : !invites?.length ? (
        <p className="text-muted p-10 text-center text-sm">No invite links yet.</p>
      ) : (
        <ul className="divide-border divide-y">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="grid gap-3 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] lg:items-center lg:gap-5"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[14px] font-medium">
                  <span className="truncate">{invite.name || invite.email || "Open invite"}</span>
                  <span className={`shrink-0 rounded border px-1.5 text-[10.5px] capitalize ${STATUS_STYLE[invite.status]}`}>
                    {invite.status}
                  </span>
                </p>
                <p className="text-muted truncate text-[12.5px]">
                  {roleLabel(invite.role)}
                  {invite.email && invite.name ? ` · ${invite.email}` : ""} ·{" "}
                  {invite.status === "used" && invite.usedAt
                    ? `used ${ago(invite.usedAt)}`
                    : invite.status === "expired"
                      ? "expired"
                      : `expires in ${timeUntil(invite.expiresAt)}`}
                </p>
              </div>
              {invite.status === "pending" ? (
                <SecretField value={invite.link} label="invite link" placeholder="Can't display link" />
              ) : (
                <span className="text-muted hidden text-[12.5px] lg:block">—</span>
              )}
              <button
                type="button"
                disabled={revoke.isPending && revoke.variables === invite.id}
                onClick={() =>
                  confirm(invite.status === "pending" ? "Revoke this invite link?" : "Remove this invite from the list?") &&
                  revoke.mutate(invite.id)
                }
                className="btn-secondary h-9 justify-self-start px-3 whitespace-nowrap lg:justify-self-end"
              >
                <Trash2 className="size-3.5" /> {invite.status === "pending" ? "Revoke" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
