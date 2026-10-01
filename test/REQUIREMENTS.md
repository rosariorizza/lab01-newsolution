# Lab01 requirements covered by the test suite

This traceability summary is derived from `Lab01 (1).pdf`. The PDF is treated as a
specification; executable behavior is asserted in `schema.test.js` and `api.test.js`.

| Requirement | Coverage |
| --- | --- |
| User email format and password length 6..20 | User schema tests |
| Film visibility and private-only fields | Film schema tests |
| Film/review ratings are non-negative and at most 10 | Schema boundary tests |
| Completed reviews require date, rating, and text | Review schema tests |
| Review text is at most 1000 characters | Review schema tests |
| Entry point, public films, and public reviews need no login | Public-resource API tests |
| Other functional resources require a session | Authentication API tests |
| Authentication uses a cookie and rejects bad credentials | Login tests |
| Password/hash data is never returned | User privacy test |
| Public film lists are paginated | Collection and page tests |
| Representations include navigation/self links | HATEOAS assertions |
| Film creator becomes owner | Film creation test |
| Only owners access/change private films | Ownership tests |
| Film input is validated against visibility rules | Invalid film request test |
| Public-film owner can invite users to review | Review lifecycle test |
| Only invited reviewer can complete a review | Reviewer authorization tests |
| Completed invitation cannot be deleted | Review lifecycle test |
| Review request body follows the review schema | Invalid invitation test |

The balanced-assignment operation is not asserted because the document makes its
implementation optional. The standalone diagnostic scripts at repository root are
left untouched and are not part of the `node:test` suite.
