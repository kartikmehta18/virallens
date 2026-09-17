/**
 * Admin bootstrap for invite-only workspaces.
 *
 *   npm run admin -- create --email you@gmail.com [--username kartik] [--name "Kartik"] [--regenerate]
 *   npm run admin -- list
 *
 * `create` promotes an existing account (matched by email or username) to admin, or creates a new admin, and
 * prints its 6-digit access key. With an email, the admin can also use "Continue with Google" with that Google
 * account. Pass --regenerate to replace an existing key (signs that account out everywhere).
 */
import "dotenv/config";
import { issueAccessKey, revealAccessKey } from "../lib/auth/access";
import { EMAIL_PATTERN, USERNAME_PATTERN } from "../lib/auth/session";
import { env } from "../lib/env";
import { getRepo } from "../lib/repo";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = index > -1 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

async function main() {
  const command = process.argv[2];
  if (!env.dbEnabled) throw new Error("Configure DB_* (or DATABASE_URL) first — roles and access keys are stored in the database.");
  const repo = await getRepo();

  if (command === "list") {
    const users = await repo.users.list();
    const admins = users.filter((u) => u.role === "admin");
    console.log(`${users.length} user(s), ${admins.length} admin(s)`);
    for (const u of users) {
      console.log(
        `- ${u.role.padEnd(5)} ${u.disabled ? "[disabled] " : ""}${u.name ?? "—"} <${u.email ?? "no email"}>${u.googleId ? " [Google]" : ""} id=${u.id}`,
      );
    }
    return;
  }

  if (command !== "create") {
    console.log(
      'Usage:\n  npm run admin -- create --email <email> [--username <name>] [--name "<display name>"] [--regenerate]\n  npm run admin -- list',
    );
    process.exitCode = 1;
    return;
  }

  const email = flag("email")?.trim().toLowerCase();
  const username = flag("username")?.trim().toLowerCase();
  const name = flag("name")?.trim();
  if (!email && !username) throw new Error("Pass --email (recommended, enables Google sign-in) and/or --username");
  if (email && !EMAIL_PATTERN.test(email)) throw new Error(`Invalid email: ${email}`);
  if (username && !USERNAME_PATTERN.test(username)) throw new Error("Username must be 3–32 characters: letters, numbers, _ or .");

  let user = (email && (await repo.users.byEmail(email))) || (username && (await repo.users.byUsername(username))) || null;
  if (user) {
    user =
      (await repo.users.update(user.id, {
        role: "admin",
        disabled: false,
        isTest: false,
        passwordHash: null, // password sign-in no longer exists
        ...(username && !user.username && { username }),
        ...(email && !user.email && { email }),
        ...(name && { name }),
      })) ?? user;
    console.log(`Promoted existing account ${user.id} to admin.`);
  } else {
    user = await repo.users.create({
      username: username ?? null,
      email: email ?? null,
      name: name || username || email!.split("@")[0],
      passwordHash: null,
      isTest: false,
      role: "admin",
    });
    console.log(`Created admin ${user.id}.`);
  }

  const existing = user.accessKeyHash ? revealAccessKey(user) : null;
  const accessKey =
    existing && !process.argv.includes("--regenerate") ? existing : await issueAccessKey(repo, user.id, Boolean(user.accessKeyHash));
  console.log(`\nAccess key (sign in at /login → access key):\n\n  ${accessKey}\n`);
  if (user.email) console.log(`Or use "Continue with Google" with the Google account ${user.email}.`);
  if (env.testMode)
    console.log("Note: TEST_MODE is on. Set TEST_MODE=off in .env to use server accounts, access keys and the admin panel.");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
