-- Current schema for a NEW EMPTY support database only. No migration/reset path.
PRAGMA foreign_keys = ON;
CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  app_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  blocked_at INTEGER,
  last_write_at INTEGER
);
CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES installations(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  agent_kind TEXT,
  agent_priority TEXT,
  agent_summary TEXT,
  agent_confidence REAL,
  agent_sequence INTEGER
);
CREATE INDEX threads_owner_created ON threads(installation_id, created_at, id);
CREATE INDEX threads_inbox ON threads(status, updated_at, id);
CREATE TABLE messages (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  thread_id TEXT NOT NULL REFERENCES threads(id),
  sender TEXT NOT NULL CHECK(sender IN ('user','operator')),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  client_context TEXT CHECK(client_context IS NULL OR json_valid(client_context))
);
CREATE INDEX messages_thread_sequence ON messages(thread_id, sequence);
-- The quota is enforced inside the same writer transaction as the first message.
-- UTC calendar day. Changing this policy requires a new, explicit schema update.
CREATE TRIGGER thread_daily_limit BEFORE INSERT ON threads BEGIN
  SELECT RAISE(ABORT, 'installation_blocked')
    WHERE (SELECT blocked_at FROM installations WHERE id=NEW.installation_id) IS NOT NULL;
  SELECT RAISE(ABORT, 'daily_thread_limit')
    WHERE (SELECT count(*) FROM threads WHERE installation_id=NEW.installation_id
      AND created_at >= unixepoch('now','start of day')) >= 3;
END;
CREATE TRIGGER message_admission BEFORE INSERT ON messages BEGIN
  SELECT RAISE(ABORT, 'thread_closed')
    WHERE (SELECT status FROM threads WHERE id=NEW.thread_id) != 'open';
  SELECT RAISE(ABORT, 'installation_blocked')
    WHERE NEW.sender='user' AND (SELECT blocked_at FROM installations
      WHERE id=(SELECT installation_id FROM threads WHERE id=NEW.thread_id)) IS NOT NULL;
  SELECT RAISE(ABORT, 'write_burst')
    WHERE NEW.sender='user' AND (SELECT last_write_at FROM installations
      WHERE id=(SELECT installation_id FROM threads WHERE id=NEW.thread_id)) > unixepoch()-2;
END;
CREATE TRIGGER message_receipt AFTER INSERT ON messages BEGIN
  UPDATE threads SET updated_at=NEW.created_at WHERE id=NEW.thread_id;
  UPDATE installations SET last_write_at=NEW.created_at WHERE NEW.sender='user'
    AND id=(SELECT installation_id FROM threads WHERE id=NEW.thread_id);
END;

CREATE INDEX installations_app ON installations(app_id,id);
CREATE TRIGGER installation_app_immutable BEFORE UPDATE OF app_id ON installations BEGIN
  SELECT RAISE(ABORT, 'installation_app_immutable') WHERE NEW.app_id != OLD.app_id;
END;
CREATE INDEX messages_support_environment ON messages(
  json_extract(client_context,'$.appVersion'),json_extract(client_context,'$.appBuild'),
  json_extract(client_context,'$.osName'),json_extract(client_context,'$.osVersion'),thread_id
) WHERE sender='user';
