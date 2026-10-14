import { MongoClient, Db } from 'mongodb';

const DEFAULT_DATABASE_NAME = 'punyakart';

let client: MongoClient | null = null;
let database: Db | null = null;

/**
 * Returns the MongoDB connection string from the environment.
 *
 * We intentionally keep the connection string in DATABASE_URL so the
 * application continues to use one standard environment variable for
 * database configuration.
 */
function getMongoConnectionString(): string {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (
    !connectionString.startsWith('mongodb://') &&
    !connectionString.startsWith('mongodb+srv://')
  ) {
    throw new Error(
      'DATABASE_URL must be a MongoDB connection string (mongodb:// or mongodb+srv://)',
    );
  }

  const environment = process.env.NODE_ENV?.trim().toLowerCase();
  const isAtlasConnection = connectionString.startsWith('mongodb+srv://');
  const isLocalConnection =
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('localhost');

  if (environment === 'development' && isAtlasConnection) {
    throw new Error(
      'Development must use a local MongoDB connection. Set DATABASE_URL to mongodb://127.0.0.1:27017.',
    );
  }

  if (environment === 'production' && isLocalConnection) {
    throw new Error(
      'Production must use MongoDB Atlas. Set DATABASE_URL to a mongodb+srv:// connection string.',
    );
  }

  return connectionString;
}

/**
 * Returns the MongoDB database name.
 *
 * PUNYAKART_DB_NAME is optional. If it is not provided, the application
 * uses the "punyakart" database.
 */
function getDatabaseName(): string {
  return process.env.PUNYAKART_DB_NAME?.trim() || DEFAULT_DATABASE_NAME;
}

/**
 * Returns a shared MongoDB client.
 *
 * The connection is created lazily on first use and reused by the
 * application for subsequent database operations.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  const connectionString = getMongoConnectionString();

  client = new MongoClient(connectionString, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  await client.connect();

  return client;
}

/**
 * Returns the shared Punyakart MongoDB database.
 */
export async function getMongoDb(): Promise<Db> {
  if (database) {
    return database;
  }

  const mongoClient = await getMongoClient();
  database = mongoClient.db(getDatabaseName());

  return database;
}

/**
 * Closes the shared MongoDB connection.
 *
 * Primarily useful for graceful application shutdown and migration scripts.
 */
export async function closeMongo(): Promise<void> {
  if (!client) {
    return;
  }

  const currentClient = client;

  client = null;
  database = null;

  await currentClient.close();
}

/**
 * Returns the configured MongoDB database name.
 */
export function getMongoDatabaseName(): string {
  return getDatabaseName();
}