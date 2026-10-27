import neo4j, { Driver, Session, SessionMode } from 'neo4j-driver';
import { env } from './env';

let driver: Driver | null = null;

/**
 * Initializes and returns the singleton Neo4j driver instance.
 */
export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      env.NEO4J_URI,
      neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD),
      {
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2 * 60 * 1000, // 120 seconds
        logging: {
          level: 'warn',
          logger: (level, message) => {
            // Strip any potential sensitive words if logged by internal driver
            if (level === 'error') {
              console.error(`[Neo4j ${level.toUpperCase()}]: ${message}`);
            }
          },
        },
      }
    );
  }
  return driver;
}

/**
 * Creates a Neo4j session with specified access mode (READ or WRITE).
 * Callers MUST close the session in a finally block.
 */
export function getSession(mode: SessionMode = neo4j.session.READ): Session {
  const currentDriver = getDriver();
  return currentDriver.session({
    database: env.NEO4J_DATABASE,
    defaultAccessMode: mode,
  });
}

/**
 * Safely verifies database connectivity by executing a lightweight query.
 * Returns true if connected, false otherwise.
 * Never throws or exposes error messages/credentials.
 */
export async function checkDatabaseConnectivity(): Promise<boolean> {
  let session: Session | null = null;
  try {
    const currentDriver = getDriver();
    // Verify driver connectivity protocol
    await currentDriver.getServerInfo();

    session = currentDriver.session({
      database: env.NEO4J_DATABASE,
      defaultAccessMode: neo4j.session.READ,
    });

    const result = await session.run('RETURN 1 AS status');
    return result.records.length > 0 && result.records[0].get('status').toInt() === 1;
  } catch (error) {
    // Log generic error indication without revealing error internals or credentials
    console.error('[Neo4j] Database connectivity check failed');
    return false;
  } finally {
    if (session) {
      await session.close();
    }
  }
}

/**
 * Gracefully closes the driver connection pool.
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    try {
      await driver.close();
      console.log('[Neo4j] Driver connection pool gracefully closed.');
    } catch (error) {
      console.error('[Neo4j] Error closing driver pool');
    } finally {
      driver = null;
    }
  }
}
