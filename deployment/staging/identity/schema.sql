-- Apply ONLY through the new identity database's first-boot init path.
-- No production migration and no automatic account enrollment.
CREATE TABLE ummah_identity_instance (
  instance_id VARCHAR(80) PRIMARY KEY,
  project_id VARCHAR(80) NOT NULL,
  environment_id VARCHAR(80) NOT NULL
) ENGINE=InnoDB;
INSERT INTO ummah_identity_instance VALUES (
  'ummahconnect-isolated-staging',
  '48d7a4cf-07dc-489b-8a3d-d6d10142b14e',
  '1f7d98bf-1d49-4d9f-a5cc-13b57abcc095'
);
CREATE TABLE review_roles (
  user_id VARCHAR(191) PRIMARY KEY,
  role ENUM('owner','reader','author','reviewer','publisher') NOT NULL,
  disabled TINYINT NOT NULL DEFAULT 0,
  updated_at VARCHAR(40) NOT NULL,
  updated_by VARCHAR(191) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE review_session_revocations (
  token_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at VARCHAR(40) NOT NULL,
  KEY session_expiry (expires_at)
) ENGINE=InnoDB;
CREATE TABLE review_session_epochs (
  user_id VARCHAR(191) PRIMARY KEY,
  revoked_after BIGINT NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB;
-- Author/reviewer/excluded identities remain EMPTY until designated by the owner.
-- Use the existing googleSubjectId issuer/subject hash; never email as identity.
