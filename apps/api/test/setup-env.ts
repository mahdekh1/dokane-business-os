// Point every test run at the TEST database, never the app database.
// CI sets DATABASE_URL_TEST; locally we fall back to the docker-compose test DB.
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://dokane:dokane@localhost:5432/dokane_test';
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret';
