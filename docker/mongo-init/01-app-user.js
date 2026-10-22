// Runs once, on the first start of an empty data volume (official mongo image entrypoint).
// Creates the least-privilege user the app and worker connect with (readWrite on the finance database only).
const dbName = process.env.MONGO_INITDB_DATABASE || 'finance';
const user = process.env.MONGO_APP_USER;
const pwd = process.env.MONGO_APP_PASSWORD;
if (!user || !pwd) throw new Error('MONGO_APP_USER and MONGO_APP_PASSWORD are required');
db.getSiblingDB(dbName).createUser({ user, pwd, roles: [{ role: 'readWrite', db: dbName }] });
print(`created app user for database ${dbName}`);
