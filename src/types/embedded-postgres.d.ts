/**
 * Ambient types for optional TTLock PG18 integration dependency.
 * Package is only required when TTLOCK_PG18_INTEGRATION=1.
 */
declare module "embedded-postgres" {
  export type EmbeddedPostgresOptions = {
    databaseDir: string;
    user?: string;
    password?: string;
    port?: number;
    persistent?: boolean;
  };

  export default class EmbeddedPostgres {
    constructor(options: EmbeddedPostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
  }
}
