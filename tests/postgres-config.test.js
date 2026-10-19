const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { resolvePostgresUrl } = require('../postgres-config');

test('URL completa em PGHOST é interpretada como conexão, incluindo o formato do erro de deploy', () => {
  for (const scheme of ['postgresql://', 'postgres://', 'PostgreSQL:/']) {
    const connectionString = resolvePostgresUrl({
      PGHOST: `${scheme}test_user:test_password@db.example.test:5433/test_db?sslmode=require&channel_binding=require`
    });
    const client = new Client({ connectionString });
    assert.equal(client.connectionParameters.host, 'db.example.test');
    assert.equal(client.connectionParameters.port, 5433);
    assert.equal(client.connectionParameters.user, 'test_user');
    assert.equal(client.connectionParameters.password, 'test_password');
    assert.equal(client.connectionParameters.database, 'test_db');
    assert.ok(client.connectionParameters.ssl);
  }
});

test('hostname comum permanece na configuração de campos separados', () => {
  assert.equal(resolvePostgresUrl({ PGHOST: 'db.example.test', PGUSER: 'user', PGPASSWORD: 'test' }), undefined);
  assert.equal(resolvePostgresUrl({}), undefined);
});

test('URLs explícitas mantêm prioridade sobre PGHOST', () => {
  const env = {
    URL_POSTGRES: 'postgresql://first.example.test/db',
    POSTGRES_URL: 'postgresql://second.example.test/db',
    DATABASE_URL: 'postgresql://third.example.test/db',
    PGHOST: 'postgresql://fourth.example.test/db'
  };
  assert.equal(resolvePostgresUrl(env), env.URL_POSTGRES);
  delete env.URL_POSTGRES;
  assert.equal(resolvePostgresUrl(env), env.POSTGRES_URL);
  delete env.POSTGRES_URL;
  assert.equal(resolvePostgresUrl(env), env.DATABASE_URL);
});

test('normalização preserva senhas codificadas e ignora espaços ao redor', () => {
  const url = resolvePostgresUrl({ DATABASE_URL: ' PostgreSQL:/test:p%40ss%3Aword@db.example.test/test_db ' });
  const client = new Client({ connectionString: url });
  assert.equal(client.connectionParameters.password, 'p@ss:word');
  assert.equal(client.connectionParameters.host, 'db.example.test');
});
