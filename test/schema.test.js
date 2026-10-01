'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const filmSchema = require('../json-schemas/film_schema.json');
const reviewSchema = require('../json-schemas/review_schema.json');
const userSchema = require('../json-schemas/user_schema.json');

function validator(schema) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

const validateFilm = validator(filmSchema);
const validateReview = validator(reviewSchema);
const validateUser = validator(userSchema);

function expectValid(validate, value) {
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

function expectInvalid(validate, value) {
  assert.equal(validate(value), false, `expected invalid value: ${JSON.stringify(value)}`);
}

describe('user schema (Lab01 section 1)', () => {
  test('accepts a valid user and email', () => {
    expectValid(validateUser, {
      id: 1,
      name: 'Alice',
      email: 'alice@example.test',
      password: 'secret1'
    });
  });

  test('rejects malformed email and passwords outside 6..20 characters', () => {
    expectInvalid(validateUser, { id: 1, email: 'not-an-email', password: 'secret1' });
    expectInvalid(validateUser, { id: 1, email: 'a@example.test', password: 'short' });
    expectInvalid(validateUser, { id: 1, email: 'a@example.test', password: 'x'.repeat(21) });
  });

  test('rejects undeclared fields', () => {
    expectInvalid(validateUser, { id: 1, email: 'a@example.test', role: 'admin' });
  });
});

describe('film schema (Lab01 section 1)', () => {
  test('accepts public and private films with their allowed fields', () => {
    expectValid(validateFilm, { title: 'Public film', private: false });
    expectValid(validateFilm, {
      title: 'Private film',
      private: true,
      watchDate: '2026-09-25',
      rating: 10,
      favorite: false
    });
  });

  test('accepts the documented non-negative lower rating bound', () => {
    expectValid(validateFilm, { title: 'Zero stars', private: true, rating: 0 });
  });

  test('rejects invalid dates, out-of-range ratings and extra fields', () => {
    expectInvalid(validateFilm, { title: 'Bad date', private: true, watchDate: '25/09/2026' });
    expectInvalid(validateFilm, { title: 'Too high', private: true, rating: 11 });
    expectInvalid(validateFilm, { title: 'Extra', private: false, genre: 'drama' });
  });

  test('rejects private-only properties on a public film', () => {
    expectInvalid(validateFilm, { title: 'Public', private: false, watchDate: '2026-09-25' });
    expectInvalid(validateFilm, { title: 'Public', private: false, rating: 8 });
    expectInvalid(validateFilm, { title: 'Public', private: false, favorite: true });
  });
});

describe('review schema (Lab01 section 1)', () => {
  test('accepts an incomplete invitation without completion details', () => {
    expectValid(validateReview, { filmId: 1, reviewerId: 2, completed: false });
  });

  test('requires all completion details for a completed review', () => {
    expectInvalid(validateReview, { filmId: 1, reviewerId: 2, completed: true });
    expectValid(validateReview, {
      filmId: 1,
      reviewerId: 2,
      completed: true,
      reviewDate: '2026-09-25',
      rating: 7,
      review: 'A concise review.'
    });
  });

  test('forbids completion details while incomplete', () => {
    expectInvalid(validateReview, {
      filmId: 1,
      reviewerId: 2,
      completed: false,
      review: 'Not completed yet.'
    });
  });

  test('accepts rating zero and rejects rating above 10 or review over 1000 chars', () => {
    expectValid(validateReview, {
      filmId: 1, reviewerId: 2, completed: true,
      reviewDate: '2026-09-25', rating: 0, review: 'No stars.'
    });
    expectInvalid(validateReview, {
      filmId: 1, reviewerId: 2, completed: true,
      reviewDate: '2026-09-25', rating: 11, review: 'Too high.'
    });
    expectInvalid(validateReview, {
      filmId: 1, reviewerId: 2, completed: true,
      reviewDate: '2026-09-25', rating: 5, review: 'x'.repeat(1001)
    });
  });
});
