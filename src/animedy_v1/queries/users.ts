// SQL string queries for the `users` table.

export const INSERT_USER = `
  INSERT INTO users (email, username, password_hash, role)
  VALUES (?, ?, ?, 'user')
`;

export const SELECT_USER_BY_EMAIL = `
  SELECT id, email, username, password_hash, role, created_at, updated_at
  FROM users
  WHERE email = ?
  LIMIT 1
`;

export const SELECT_USER_BY_USERNAME = `
  SELECT id, email, username, password_hash, role, created_at, updated_at
  FROM users
  WHERE username = ?
  LIMIT 1
`;

export const SELECT_USER_BY_ID = `
  SELECT id, email, username, password_hash, role, created_at, updated_at
  FROM users
  WHERE id = ?
  LIMIT 1
`;
