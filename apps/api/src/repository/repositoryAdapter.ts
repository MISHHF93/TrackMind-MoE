/** CQRS repository adapter — in-memory default with Postgres opt-in (Wave 01 / Wave 20 wiring). */

export {
  createRepository,
  resolvePersistenceMode,
  InMemoryRepository,
  PostgresRepositoryStub,
  type KeyValueRepository,
  type PersistenceMode,
  type RepositoryConfig,
} from './index.js';
