import bcrypt from 'bcryptjs';
import { getDatabase } from '../config/database.js';
import { IS_PRODUCTION } from '../config/security.js';

/**
 * Development-only identity of the demo admin account that is created by the
 * demo seed script. This is intentionally only the *identity* (email), not the
 * default password. The password is verified only by comparing the stored hash
 * with the known default password using bcrypt, never by logging or comparing
 * plaintext values.
 *
 * The default password is the one documented for local development/demo use and
 * created by server/scripts/seed.js. It must not be emitted in production logs
 * or stored in any new config/database/environment location.
 */
const DEMO_ADMIN_EMAIL = 'admin@ecoguard.com';
const DEMO_ADMIN_DEFAULT_PASSWORD = 'admin123';

/**
 * In production, fail closed if the known demo admin account still exists and
 * still has the default seeded credential.
 *
 * This is intentionally a startup-time gate. It does not replace proper
 * credential rotation, account provisioning, or audit processes; it only
 * prevents the most predictable demo admin from remaining usable after a
 * production deployment.
 */
export async function assertNoLiveDefaultDemoAdminInProduction() {
  if (!IS_PRODUCTION) {
    return;
  }

  const db = await getDatabase();
  const admin = await db.get(
    'SELECT id, email, password FROM users WHERE email = ?',
    [DEMO_ADMIN_EMAIL]
  );

  if (!admin) {
    return;
  }

  if (typeof admin.password !== 'string') {
    // Malformed row; safer to refuse startup than to guess.
    throw new Error(
      'Production startup blocked: unexpected admin account state for ' +
        `${DEMO_ADMIN_EMAIL}`
    );
  }

  const stillHasDefaultPassword = await bcrypt.compare(
    DEMO_ADMIN_DEFAULT_PASSWORD,
    admin.password
  );

  if (!stillHasDefaultPassword) {
    return;
  }

  throw new Error(
    'Production startup blocked: the default demo admin account is still ' +
      'usable. Change or remove the demo admin password before deploying to ' +
      'production. Do not reset it to a predictable value.'
  );
}
