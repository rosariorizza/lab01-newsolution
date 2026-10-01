'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});

addFormats(ajv);

function loadSchema(name) {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, 'json-schemas', name),
      'utf8'
    )
  );
}

const validateFilm = ajv.compile(loadSchema('film_schema.json'));
const validateReview = ajv.compile(loadSchema('review_schema.json'));
const validateUser = ajv.compile(loadSchema('user_schema.json'));

const tests = [];

function test(group, name, validator, value, expected) {
  tests.push({ group, name, validator, value, expected });
}

/* -------------------------------------------------------------------------- */
/* Film                                                                       */
/* -------------------------------------------------------------------------- */

const privateFilm = {
  title: 'A Film',
  private: true,
};

const publicFilm = {
  title: 'A Film',
  private: false,
};

test('Film', 'minimal private film',
  validateFilm,
  privateFilm,
  true);

test('Film', 'minimal public film',
  validateFilm,
  publicFilm,
  true);

test('Film', 'missing title',
  validateFilm,
  { private: true },
  false);

test('Film', 'missing private',
  validateFilm,
  { title: 'A Film' },
  false);

test('Film', 'wrong title type',
  validateFilm,
  { title: 42, private: true },
  false);

test('Film', 'wrong private type',
  validateFilm,
  { title: 'A Film', private: 'true' },
  false);

test('Film', 'invalid date',
  validateFilm,
  {
    ...privateFilm,
    watchDate: '24-09-2026',
  },
  false);

test('Film', 'rating below minimum',
  validateFilm,
  {
    ...privateFilm,
    rating: 0,
  },
  false);

test('Film', 'rating above maximum',
  validateFilm,
  {
    ...privateFilm,
    rating: 11,
  },
  false);

test('Film', 'additional property',
  validateFilm,
  {
    ...privateFilm,
    unexpected: true,
  },
  false);

/*
 * dependencies + const
 */

test('Film dependencies',
  'watchDate allowed when private=true',
  validateFilm,
  {
    ...privateFilm,
    watchDate: '2026-09-24',
  },
  true);

test('Film dependencies',
  'watchDate forbidden when private=false',
  validateFilm,
  {
    ...publicFilm,
    watchDate: '2026-09-24',
  },
  false);

test('Film dependencies',
  'rating allowed when private=true',
  validateFilm,
  {
    ...privateFilm,
    rating: 8,
  },
  true);

test('Film dependencies',
  'rating forbidden when private=false',
  validateFilm,
  {
    ...publicFilm,
    rating: 8,
  },
  false);

test('Film dependencies',
  'favorite allowed when private=true',
  validateFilm,
  {
    ...privateFilm,
    favorite: true,
  },
  true);

test('Film dependencies',
  'favorite forbidden when private=false',
  validateFilm,
  {
    ...publicFilm,
    favorite: true,
  },
  false);

/* -------------------------------------------------------------------------- */
/* Review                                                                     */
/* -------------------------------------------------------------------------- */

const pendingReview = {
  filmId: 1,
  reviewerId: 2,
  completed: false,
};

const completedReview = {
  filmId: 1,
  reviewerId: 2,
  completed: true,
  reviewDate: '2026-09-24',
  rating: 8,
  review: 'Good film.',
};

test('Review', 'pending review',
  validateReview,
  pendingReview,
  true);

test('Review', 'completed review',
  validateReview,
  completedReview,
  true);

test('Review', 'missing filmId',
  validateReview,
  {
    reviewerId: 2,
    completed: false,
  },
  false);

test('Review', 'missing reviewerId',
  validateReview,
  {
    filmId: 1,
    completed: false,
  },
  false);

test('Review', 'missing completed',
  validateReview,
  {
    filmId: 1,
    reviewerId: 2,
  },
  false);

test('Review dependencies',
  'completed=false forbids reviewDate',
  validateReview,
  {
    ...pendingReview,
    reviewDate: '2026-09-24',
  },
  false);

test('Review dependencies',
  'completed=false forbids rating',
  validateReview,
  {
    ...pendingReview,
    rating: 8,
  },
  false);

test('Review dependencies',
  'completed=false forbids review',
  validateReview,
  {
    ...pendingReview,
    review: 'Text',
  },
  false);

test('Review dependencies',
  'completed=true requires reviewDate',
  validateReview,
  {
    filmId: 1,
    reviewerId: 2,
    completed: true,
    rating: 8,
    review: 'Good film.',
  },
  false);

test('Review dependencies',
  'completed=true requires rating',
  validateReview,
  {
    filmId: 1,
    reviewerId: 2,
    completed: true,
    reviewDate: '2026-09-24',
    review: 'Good film.',
  },
  false);

test('Review dependencies',
  'completed=true requires review',
  validateReview,
  {
    filmId: 1,
    reviewerId: 2,
    completed: true,
    reviewDate: '2026-09-24',
    rating: 8,
  },
  false);

test('Review', 'invalid date',
  validateReview,
  {
    ...completedReview,
    reviewDate: '24-09-2026',
  },
  false);

test('Review', 'rating above maximum',
  validateReview,
  {
    ...completedReview,
    rating: 11,
  },
  false);

test('Review', 'review longer than 1000 chars',
  validateReview,
  {
    ...completedReview,
    review: 'x'.repeat(1001),
  },
  false);

test('Review', 'additional property',
  validateReview,
  {
    ...pendingReview,
    unexpected: true,
  },
  false);

/* -------------------------------------------------------------------------- */
/* User                                                                       */
/* -------------------------------------------------------------------------- */

test('User', 'minimal user',
  validateUser,
  {
    email: 'user@example.com',
  },
  true);

test('User', 'valid complete user',
  validateUser,
  {
    id: 1,
    email: 'user@example.com',
    name: 'User',
    password: '123456',
  },
  true);

test('User', 'missing email',
  validateUser,
  {
    name: 'User',
  },
  false);

test('User', 'invalid email',
  validateUser,
  {
    email: 'not-an-email',
  },
  false);

test('User', 'password too short',
  validateUser,
  {
    email: 'user@example.com',
    password: '12345',
  },
  false);

test('User', 'password length 6',
  validateUser,
  {
    email: 'user@example.com',
    password: '123456',
  },
  true);

test('User', 'password length 20',
  validateUser,
  {
    email: 'user@example.com',
    password: '12345678901234567890',
  },
  true);

test('User', 'password too long',
  validateUser,
  {
    email: 'user@example.com',
    password: '123456789012345678901',
  },
  false);

test('User', 'additional property',
  validateUser,
  {
    email: 'user@example.com',
    unexpected: true,
  },
  false);

/* -------------------------------------------------------------------------- */
/* Runner                                                                     */
/* -------------------------------------------------------------------------- */

let passed = 0;
let failed = 0;
let currentGroup = null;

for (const t of tests) {
  if (t.group !== currentGroup) {
    currentGroup = t.group;
    console.log(`\n[${currentGroup}]`);
  }

  const actual = t.validator(t.value);
  const ok = actual === t.expected;

  if (ok) {
    ++passed;
    console.log(`  PASS  ${t.name}`);
  } else {
    ++failed;
    console.log(`  FAIL  ${t.name}`);
    console.log(
      `        expected ${t.expected}, got ${actual}`
    );

    if (t.validator.errors) {
      console.log(
        '        ' +
        JSON.stringify(t.validator.errors)
      );
    }
  }
}

console.log(
  '\n------------------------------------------------------------'
);

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(
    '\nAll JSON Schema tests passed with AJV directly.'
  );
}