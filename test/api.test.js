'use strict';

const { before, after, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

let server;
let baseUrl;
let tempDirectory;

const execSql = (db, sql) => new Promise((resolve, reject) =>
  db.exec(sql, error => error ? reject(error) : resolve()));
const runSql = (db, sql, values) => new Promise((resolve, reject) =>
  db.run(sql, values, error => error ? reject(error) : resolve()));

async function createFixture(filename) {
  const db = new sqlite3.Database(filename);
  await execSql(db, `
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT, hash TEXT NOT NULL);
    CREATE TABLE films (id INTEGER PRIMARY KEY, title TEXT NOT NULL, owner INTEGER NOT NULL REFERENCES users(id), private INTEGER NOT NULL DEFAULT 1, watchDate TEXT, rating INTEGER, favorite INTEGER);
    CREATE TABLE reviews (filmId INTEGER REFERENCES films(id), reviewerId INTEGER REFERENCES users(id), completed INTEGER NOT NULL DEFAULT 0, reviewDate TEXT, rating INTEGER, review TEXT, PRIMARY KEY(filmId, reviewerId));
  `);
  const hash = bcrypt.hashSync('password', 4);
  for (const user of [
    [1, 'owner@example.test', 'Owner', hash],
    [2, 'reviewer@example.test', 'Reviewer', hash],
    [3, 'other@example.test', 'Other', hash]
  ]) await runSql(db, 'INSERT INTO users(id,email,name,hash) VALUES(?,?,?,?)', user);
  await runSql(db, 'INSERT INTO films VALUES(?,?,?,?,?,?,?)', [1, 'Private seed', 1, 1, '2026-01-01', 8, 1]);
  await runSql(db, 'INSERT INTO films(id,title,owner,private) VALUES(?,?,?,?)', [2, 'Public seed', 1, 0]);
  await runSql(db, 'INSERT INTO films(id,title,owner,private) VALUES(?,?,?,?)', [3, 'Other public', 3, 0]);
  await runSql(db, 'INSERT INTO reviews(filmId,reviewerId,completed) VALUES(?,?,?)', [2, 2, 0]);
  await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
}

function startServer(database) {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: '0', FILM_MANAGER_DB_PATH: database },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let errors = '';
    const timeout = setTimeout(() => reject(new Error(`server startup timed out: ${errors}`)), 10000);
    server.stderr.on('data', chunk => { errors += chunk; });
    server.stdout.on('data', chunk => {
      const match = chunk.toString().match(/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
    server.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`server exited during startup (${code}): ${errors}`));
    });
  });
}

async function request(route, { cookie, body, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(baseUrl + route, {
    ...options, headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function bodyOf(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function login(email) {
  const response = await request('/api/users/authenticator', {
    method: 'POST', body: { email, password: 'password' }
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie, 'login must set a session cookie');
  return cookie.split(';', 1)[0];
}

before(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'film-manager-tests-'));
  const database = path.join(tempDirectory, 'test.db');
  await createFixture(database);
  baseUrl = await startServer(database);
});

after(async () => {
  if (server?.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
  }
  if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('public resources and HATEOAS', () => {
  test('entry point exposes navigable links without authentication', async () => {
    const response = await request('/api');
    assert.equal(response.status, 200);
    const body = await bodyOf(response);
    assert.equal(body.publicFilms, '/api/films/public/');
    assert.equal(body.usersAuthenticator, '/api/users/authenticator');
  });

  test('public list is paginated, public-only, and self-linked', async () => {
    const response = await request('/api/films/public');
    assert.equal(response.status, 200);
    const body = await bodyOf(response);
    assert.deepEqual([body.currentPage, body.totalItems, body.films.length], [1, 2, 2]);
    assert.ok(body.films.every(film => !film.private && film.self === `/api/films/public/${film.id}`));
    assert.equal((await request('/api/films/public?pageNo=0')).status, 404);
    assert.equal((await request('/api/films/public?pageNo=99')).status, 404);
  });

  test('single public film and review are public; private film is hidden', async () => {
    const filmResponse = await request('/api/films/public/2');
    assert.equal(filmResponse.status, 200);
    assert.equal((await bodyOf(filmResponse)).reviews, '/api/films/public/2/reviews');
    const reviewResponse = await request('/api/films/public/2/reviews/2');
    assert.equal(reviewResponse.status, 200);
    assert.equal((await bodyOf(reviewResponse)).self, '/api/films/public/2/reviews/2');
    assert.equal((await request('/api/films/public/1')).status, 404);
  });
});

describe('authentication and privacy', () => {
  test('protected collections reject anonymous clients', async () => {
    for (const route of ['/api/users', '/api/films/private', '/api/films/public/invited'])
      assert.equal((await request(route)).status, 401, route);
  });

  test('bad credentials are rejected and sessions expose no hashes', async () => {
    assert.equal((await request('/api/users/authenticator', {
      method: 'POST', body: { email: 'owner@example.test', password: 'wrong' }
    })).status, 401);
    const cookie = await login('owner@example.test');
    const response = await request('/api/users', { cookie });
    assert.equal(response.status, 200);
    const users = await bodyOf(response);
    assert.equal(users.length, 3);
    for (const user of users) {
      assert.equal(user.password, undefined);
      assert.equal(user.hash, undefined);
      assert.equal(user.self, `/api/users/${user.id}`);
    }
  });
});

describe('film ownership and CRUD', () => {
  test('only the owner retrieves a private film', async () => {
    const owner = await login('owner@example.test');
    const other = await login('other@example.test');
    assert.equal((await request('/api/films/private/1', { cookie: owner })).status, 200);
    assert.equal((await request('/api/films/private/1', { cookie: other })).status, 403);
  });

  test('creator becomes owner and can update and delete', async () => {
    const cookie = await login('owner@example.test');
    const createdResponse = await request('/api/films', {
      method: 'POST', cookie,
      body: { title: 'Created privately', private: true, watchDate: '2026-09-25', rating: 9, favorite: false }
    });
    assert.equal(createdResponse.status, 201);
    const film = await bodyOf(createdResponse);
    assert.equal(film.owner, 1);
    assert.equal((await request(`/api/films/private/${film.id}`, {
      method: 'PUT', cookie,
      body: { title: 'Updated privately', private: true, watchDate: '2026-09-24', rating: 10, favorite: true }
    })).status, 204);
    const updated = await bodyOf(await request(`/api/films/private/${film.id}`, { cookie }));
    assert.equal(updated.title, 'Updated privately');
    assert.equal(updated.favorite, true);
    assert.equal((await request(`/api/films/private/${film.id}`, { method: 'DELETE', cookie })).status, 204);
    assert.equal((await request(`/api/films/private/${film.id}`, { cookie })).status, 404);
  });

  test('film request body is schema validated', async () => {
    const cookie = await login('owner@example.test');
    assert.equal((await request('/api/films', {
      method: 'POST', cookie,
      body: { title: 'Invalid public data', private: false, rating: 8 }
    })).status, 400);
  });
});

describe('review invitation lifecycle', () => {
  test('owner invites, reviewer completes, and completed review cannot be removed', async () => {
    const owner = await login('owner@example.test');
    const reviewer = await login('reviewer@example.test');
    const created = await bodyOf(await request('/api/films', {
      method: 'POST', cookie: owner, body: { title: 'Workflow film', private: false }
    }));
    assert.equal((await request(`/api/films/public/${created.id}/reviews`, {
      method: 'POST', cookie: owner,
      body: [{ filmId: created.id, reviewerId: 2, completed: false }]
    })).status, 201);
    assert.equal((await request(`/api/films/public/${created.id}/reviews/2`, {
      method: 'PUT', cookie: reviewer,
      body: { filmId: created.id, reviewerId: 2, completed: true, reviewDate: '2026-09-25', rating: 8, review: 'Complete.' }
    })).status, 204);
    const saved = await bodyOf(await request(`/api/films/public/${created.id}/reviews/2`));
    assert.equal(saved.completed, true);
    assert.equal(saved.review, 'Complete.');
    assert.equal((await request(`/api/films/public/${created.id}/reviews/2`, {
      method: 'DELETE', cookie: owner
    })).status, 409);
  });

  test('only invited reviewer completes and only owner issues', async () => {
    const other = await login('other@example.test');
    assert.equal((await request('/api/films/public/2/reviews/2', {
      method: 'PUT', cookie: other,
      body: { filmId: 2, reviewerId: 2, completed: true, reviewDate: '2026-09-25', rating: 7, review: 'No.' }
    })).status, 403);
    assert.equal((await request('/api/films/public/2/reviews', {
      method: 'POST', cookie: other,
      body: [{ filmId: 2, reviewerId: 3, completed: false }]
    })).status, 403);
  });

  test('invitation input is validated before the service is called', async () => {
    const owner = await login('owner@example.test');
    const cases = [
      { body: {}, status: 400 },
      { body: [], status: 400 },
      { body: [{ filmId: 2, reviewerId: 3 }], status: 400 },
      { body: [{ filmId: '2', reviewerId: 3, completed: false }], status: 400 },
      { body: [{ filmId: 2, reviewerId: 3, completed: false, review: 'Premature.' }], status: 400 },
      {
        body: [{ filmId: 2, reviewerId: 3, completed: true, reviewDate: '2026-09-25', rating: 8, review: 'Already complete.' }],
        status: 409
      },
      { body: [{ filmId: 3, reviewerId: 3, completed: false }], status: 409 },
      {
        body: [
          { filmId: 2, reviewerId: 3, completed: false },
          { filmId: 2, reviewerId: 3, completed: false }
        ],
        status: 409
      }
    ];

    for (const testCase of cases) {
      const response = await request('/api/films/public/2/reviews', {
        method: 'POST', cookie: owner, body: testCase.body
      });
      assert.equal(response.status, testCase.status, JSON.stringify(testCase.body));
    }

    assert.equal((await request('/api/films/public/2/reviews/3')).status, 404);
  });
});
