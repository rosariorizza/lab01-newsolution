'use strict';

/**
 * Integration test for JSON Schema -> OpenAPI Generator -> express-openapi-validator.
 *
 * Usage:
 *   npm run generate
 *   node openapi-schema-compatibility-test.js
 *
 * The real Film Manager server must NOT be running.
 * This script starts a temporary Express server on an ephemeral port and
 * validates requests against generated/api/openapi.yaml.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const OpenApiValidator = require('express-openapi-validator');

const generatedSpec = path.join(
  __dirname,
  'api',
  'openapi.yaml'
);

if (!fs.existsSync(generatedSpec)) {
  console.error('ERROR: generated/api/openapi.yaml does not exist.');
  console.error('Run "npm run generate" first.');
  process.exit(2);
}

const app = express();

app.use(express.json());

app.use(
  OpenApiValidator.middleware({
    apiSpec: generatedSpec,
    validateRequests: true,
    validateSecurity: false,
  })
);

/*
 * If validation succeeds, stop here.
 * No controller, service, authentication or database logic is executed.
 */
app.use((req, res) => {
  res.status(204).end();
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.message,
    errors: err.errors,
  });
});

const tests = [];

function test(group, name, method, requestPath, body, accepted) {
  tests.push({
    group,
    name,
    method,
    requestPath,
    body,
    accepted,
  });
}

const validFilmPrivate = {
  title: 'A Film',
  private: true,
};

const validFilmPublic = {
  title: 'A Public Film',
  private: false,
};

/* -------------------------------------------------------------------------- */
/* Film                                                                       */
/* -------------------------------------------------------------------------- */

test(
  'Film',
  'minimal private film',
  'POST',
  '/api/films',
  validFilmPrivate,
  true
);

test(
  'Film',
  'minimal public film',
  'POST',
  '/api/films',
  validFilmPublic,
  true
);

test(
  'Film',
  'all optional fields with correct types',
  'POST',
  '/api/films',
  {
    id: 1,
    title: 'A Film',
    owner: 2,
    private: true,
    watchDate: '2026-09-24',
    rating: 10,
    favorite: true,
  },
  true
);

test(
  'Film',
  'missing title',
  'POST',
  '/api/films',
  {
    private: true,
  },
  false
);

test(
  'Film',
  'missing private',
  'POST',
  '/api/films',
  {
    title: 'A Film',
  },
  false
);

test(
  'Film',
  'null body',
  'POST',
  '/api/films',
  null,
  false
);

test(
  'Film',
  'title must be a string',
  'POST',
  '/api/films',
  {
    title: 42,
    private: true,
  },
  false
);

test(
  'Film',
  'private must be boolean',
  'POST',
  '/api/films',
  {
    title: 'A Film',
    private: 'true',
  },
  false
);

test(
  'Film',
  'id must be integer',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    id: '1',
  },
  false
);

test(
  'Film',
  'owner must be integer',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    owner: '2',
  },
  false
);

test(
  'Film',
  'watchDate must use date format',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    watchDate: '24-09-2026',
  },
  false
);

test(
  'Film',
  'rating lower bound',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    rating: 0,
  },
  false
);

test(
  'Film',
  'rating upper bound',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    rating: 11,
  },
  false
);

test(
  'Film',
  'rating must be integer',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    rating: 7.5,
  },
  false
);

test(
  'Film',
  'favorite must be boolean',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    favorite: 'false',
  },
  false
);

test(
  'Film',
  '$schema must be a string',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    $schema: 12,
  },
  false
);

test(
  'Film',
  'additional properties are forbidden',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    unexpected: 'x',
  },
  false
);

/*
 * Draft 7: dependencies + const
 */

test(
  'Film dependencies',
  'watchDate allowed when private=true',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    watchDate: '2026-09-24',
  },
  true
);

test(
  'Film dependencies',
  'watchDate forbidden when private=false',
  'POST',
  '/api/films',
  {
    ...validFilmPublic,
    watchDate: '2026-09-24',
  },
  false
);

test(
  'Film dependencies',
  'rating allowed when private=true',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    rating: 8,
  },
  true
);

test(
  'Film dependencies',
  'rating forbidden when private=false',
  'POST',
  '/api/films',
  {
    ...validFilmPublic,
    rating: 8,
  },
  false
);

test(
  'Film dependencies',
  'favorite allowed when private=true',
  'POST',
  '/api/films',
  {
    ...validFilmPrivate,
    favorite: true,
  },
  true
);

test(
  'Film dependencies',
  'favorite forbidden when private=false',
  'POST',
  '/api/films',
  {
    ...validFilmPublic,
    favorite: true,
  },
  false
);

/* -------------------------------------------------------------------------- */
/* Review                                                                     */
/* -------------------------------------------------------------------------- */

const validPendingReview = {
  filmId: 1,
  reviewerId: 2,
  completed: false,
};

const validCompletedReview = {
  filmId: 1,
  reviewerId: 2,
  completed: true,
  reviewDate: '2026-09-24',
  rating: 8,
  review: 'Good film.',
};

const reviewPath =
  '/api/films/public/1/reviews/2';

test(
  'Review',
  'minimal pending review',
  'PUT',
  reviewPath,
  validPendingReview,
  true
);

test(
  'Review',
  'complete review',
  'PUT',
  reviewPath,
  validCompletedReview,
  true
);

test(
  'Review',
  'missing filmId',
  'PUT',
  reviewPath,
  {
    reviewerId: 2,
    completed: false,
  },
  false
);

test(
  'Review',
  'missing reviewerId',
  'PUT',
  reviewPath,
  {
    filmId: 1,
    completed: false,
  },
  false
);

test(
  'Review',
  'missing completed',
  'PUT',
  reviewPath,
  {
    filmId: 1,
    reviewerId: 2,
  },
  false
);

test(
  'Review',
  'filmId must be integer',
  'PUT',
  reviewPath,
  {
    ...validPendingReview,
    filmId: '1',
  },
  false
);

test(
  'Review',
  'reviewerId must be integer',
  'PUT',
  reviewPath,
  {
    ...validPendingReview,
    reviewerId: '2',
  },
  false
);

test(
  'Review',
  'completed must be boolean',
  'PUT',
  reviewPath,
  {
    ...validPendingReview,
    completed: 'false',
  },
  false
);

test(
  'Review',
  'reviewDate must use date format',
  'PUT',
  reviewPath,
  {
    ...validCompletedReview,
    reviewDate: '24-09-2026',
  },
  false
);

test(
  'Review',
  'rating lower bound',
  'PUT',
  reviewPath,
  {
    ...validCompletedReview,
    rating: 0,
  },
  false
);

test(
  'Review',
  'rating upper bound',
  'PUT',
  reviewPath,
  {
    ...validCompletedReview,
    rating: 11,
  },
  false
);

test(
  'Review',
  'rating must be integer',
  'PUT',
  reviewPath,
  {
    ...validCompletedReview,
    rating: 7.5,
  },
  false
);

test(
  'Review',
  'review maximum length',
  'PUT',
  reviewPath,
  {
    ...validCompletedReview,
    review: 'x'.repeat(1001),
  },
  false
);

test(
  'Review',
  'additional properties are forbidden',
  'PUT',
  reviewPath,
  {
    ...validPendingReview,
    unexpected: 'x',
  },
  false
);

/*
 * Draft 7: dependencies + oneOf + allOf + not + const
 */

test(
  'Review dependencies',
  'completed=false forbids reviewDate',
  'PUT',
  reviewPath,
  {
    ...validPendingReview,
    reviewDate: '2026-09-24',
  },
  false
);

test(
  'Review dependencies',
  'completed=false forbids rating',
  'PUT',
  reviewPath,
  {
    ...validPendingReview,
    rating: 8,
  },
  false
);

test(
  'Review dependencies',
  'completed=false forbids review text',
  'PUT',
  reviewPath,
  {
    ...validPendingReview,
    review: 'Premature review.',
  },
  false
);

test(
  'Review dependencies',
  'completed=false forbids all completion fields',
  'PUT',
  reviewPath,
  {
    ...validPendingReview,
    reviewDate: '2026-09-24',
    rating: 8,
    review: 'Premature review.',
  },
  false
);

test(
  'Review dependencies',
  'completed=true requires reviewDate',
  'PUT',
  reviewPath,
  {
    filmId: 1,
    reviewerId: 2,
    completed: true,
    rating: 8,
    review: 'Good film.',
  },
  false
);

test(
  'Review dependencies',
  'completed=true requires rating',
  'PUT',
  reviewPath,
  {
    filmId: 1,
    reviewerId: 2,
    completed: true,
    reviewDate: '2026-09-24',
    review: 'Good film.',
  },
  false
);

test(
  'Review dependencies',
  'completed=true requires review text',
  'PUT',
  reviewPath,
  {
    filmId: 1,
    reviewerId: 2,
    completed: true,
    reviewDate: '2026-09-24',
    rating: 8,
  },
  false
);

/*
 * Review used inside an array
 */

test(
  'Review array',
  'array with valid review',
  'POST',
  '/api/films/public/1/reviews',
  [
    validPendingReview,
  ],
  true
);

test(
  'Review array',
  'array item is validated',
  'POST',
  '/api/films/public/1/reviews',
  [
    {
      ...validPendingReview,
      completed: false,
      rating: 8,
    },
  ],
  false
);

/* -------------------------------------------------------------------------- */
/* User                                                                       */
/* -------------------------------------------------------------------------- */

const userPath =
  '/api/users/authenticator';

test(
  'User',
  'minimal user',
  'POST',
  userPath,
  {
    email: 'user@example.com',
  },
  true
);

test(
  'User',
  'user with all properties',
  'POST',
  userPath,
  {
    id: 1,
    email: 'user@example.com',
    name: 'User',
    password: '123456',
  },
  true
);

test(
  'User',
  'missing email',
  'POST',
  userPath,
  {
    name: 'User',
  },
  false
);

test(
  'User',
  'email format',
  'POST',
  userPath,
  {
    email: 'not-an-email',
  },
  false
);

test(
  'User',
  'id must be integer',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    id: '1',
  },
  false
);

test(
  'User',
  'name must be string',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    name: 123,
  },
  false
);

test(
  'User',
  'password minimum length',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    password: '12345',
  },
  false
);

test(
  'User',
  'password length 6 is accepted',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    password: '123456',
  },
  true
);

test(
  'User',
  'password length 20 is accepted',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    password: '12345678901234567890',
  },
  true
);

test(
  'User',
  'password maximum length',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    password: '123456789012345678901',
  },
  false
);

test(
  'User',
  'password must be string',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    password: 123456,
  },
  false
);

test(
  'User',
  '$schema must be a string',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    $schema: 12,
  },
  false
);

test(
  'User',
  'additional properties are forbidden',
  'POST',
  userPath,
  {
    email: 'user@example.com',
    unexpected: 'x',
  },
  false
);

/* -------------------------------------------------------------------------- */
/* OpenAPI-specific validation                                                */
/* -------------------------------------------------------------------------- */

test(
  'OpenAPI',
  'film requestBody is required',
  'POST',
  '/api/films',
  undefined,
  false
);

test(
  'OpenAPI',
  'filmId path parameter must be integer',
  'GET',
  '/api/films/public/not-an-integer',
  undefined,
  false
);

test(
  'OpenAPI',
  'integer filmId path parameter is accepted',
  'GET',
  '/api/films/public/1',
  undefined,
  true
);

test(
  'OpenAPI',
  'pageNo query parameter must be integer',
  'GET',
  '/api/films/public?pageNo=abc',
  undefined,
  false
);

test(
  'OpenAPI',
  'integer pageNo query parameter is accepted',
  'GET',
  '/api/films/public?pageNo=1',
  undefined,
  true
);

/* -------------------------------------------------------------------------- */
/* Runner                                                                     */
/* -------------------------------------------------------------------------- */

async function send(baseUrl, currentTest) {
  const options = {
    method: currentTest.method,
    headers: {},
  };

  if (currentTest.body !== undefined) {
    options.headers['content-type'] = 'application/json';
    options.body = JSON.stringify(currentTest.body);
  }

  const response = await fetch(
    baseUrl + currentTest.requestPath,
    options
  );

  const text = await response.text();

  let details = text;

  try {
    details = text
      ? JSON.stringify(JSON.parse(text))
      : '';
  } catch (_) {
    // Keep raw response body.
  }

  return {
    status: response.status,
    details,
  };
}

async function main() {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(
      0,
      '127.0.0.1',
      () => resolve(instance)
    );

    instance.on('error', reject);
  });

  const address = server.address();

  const baseUrl =
    `http://127.0.0.1:${address.port}`;

  let passed = 0;
  let failed = 0;
  let currentGroup = null;

  try {
    for (const currentTest of tests) {
      if (currentGroup !== currentTest.group) {
        currentGroup = currentTest.group;
        console.log(`\n[${currentGroup}]`);
      }

      const result =
        await send(baseUrl, currentTest);

      const expectedStatus =
        currentTest.accepted
          ? 204
          : 400;

      const ok =
        result.status === expectedStatus;

      if (ok) {
        passed += 1;

        console.log(
          `  PASS  ${currentTest.name}`
        );
      } else {
        failed += 1;

        console.log(
          `  FAIL  ${currentTest.name}`
        );

        console.log(
          `        expected HTTP ${expectedStatus}, got HTTP ${result.status}`
        );

        if (result.details) {
          console.log(
            `        ${result.details}`
          );
        }
      }
    }
  } finally {
    await new Promise((resolve) =>
      server.close(resolve)
    );
  }

  console.log(
    '\n------------------------------------------------------------'
  );

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    console.log(
      '\nAt least one JSON Schema/OpenAPI compatibility check failed.'
    );

    process.exitCode = 1;
  } else {
    console.log(
      '\nAll JSON Schema constraints tested here survived the generated OpenAPI pipeline.'
    );
  }
}

main().catch((err) => {
  console.error(
    '\nTest suite could not start:'
  );

  console.error(
    err && err.stack
      ? err.stack
      : err
  );

  process.exit(2);
});