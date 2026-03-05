const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const pool = require('../db');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.APP_URL || ''}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
        const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';

        // Look up by google_id first, then by email
        let user = null;
        const byGoogleId = await pool.query('SELECT * FROM users WHERE google_id=$1', [googleId]);
        if (byGoogleId.rows.length) {
          user = byGoogleId.rows[0];
        } else if (email) {
          const byEmail = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
          if (byEmail.rows.length) {
            // Link google_id to existing account
            await pool.query('UPDATE users SET google_id=$1 WHERE id=$2', [googleId, byEmail.rows[0].id]);
            user = { ...byEmail.rows[0], google_id: googleId };
          }
        }

        if (!user) {
          // Create new customer account
          const result = await pool.query(
            `INSERT INTO users(first_name, last_name, email, google_id, role, approved)
             VALUES($1, $2, $3, $4, 'customer', true)
             RETURNING *`,
            [firstName, lastName, email || null, googleId]
          );
          user = result.rows[0];
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    done(null, result.rows[0] || false);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
