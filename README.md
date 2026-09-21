
# Film Manager Service

## Overview

This project implements the REST APIs for the interaction with the Film Manager service.

The project uses an OpenAPI specification (`api/openapi.yaml`) as the blueprint for the REST interface. OpenAPI Generator is used to automatically generate the routing layer that connects the API operations to the application controllers.

## Requirements

The following software is required:

- Node.js 22
- npm
- Java

On the LabInf machines, use `nvm` to install and select the required Node.js version:

```bash
nvm install 22
```

Then install the project dependencies:

```bash
npm ci
```

## Generating the Server Stub

The server routing layer is generated directly from the OpenAPI specification using [OpenAPI Generator](https://openapi-generator.tech/).

Run:

```bash
npm run generate
```

The generated files are placed in the `generated/` folder.

The `generated/` folder must not be edited manually, since its contents are recreated every time the generation command is executed.

Whenever `api/openapi.yaml` is modified, run again:

```bash
npm run generate
```

## Integration

The main parts to complete are:

1. `api/openapi.json` – define the REST API, including paths, operations, parameters, responses, and authentication requirements.
2. `json-schemas/` – define the JSON Schemas used by the API. These schemas can be referenced from the OpenAPI document using `$ref`.
3. `components/` – replace all occurrences of the placeholder `/change/me` with the correct API URLs.
4. `controllers/` – implement the controller logic and connect each operation to the provided services.

The business logic is already provided in the `service/` folder.

Request validation and API routing are automatically handled according to the OpenAPI specification.

### Controller Mapping

The generated routing layer uses the first OpenAPI `tag` and the `operationId` of each operation to determine which controller must handle the request.

For example:

```yaml
tags:
  - ApiFilmsPublic
operationId: getPublicFilms
```

corresponds to the controller file:

```text
controllers/ApiFilmsPublic.js
```

which must export:

```js
module.exports.getPublicFilms = ...
```

Therefore:

```text
first tag    -> controller file name
operationId  -> exported function name
```

Operations sharing the same first tag are handled by the same controller file.

The generated files inside `generated/` may use different internal names and must not be edited manually.

## Running the Server

After generating the routing layer, start the server with:

```bash
npm start
```

The server is available at:

```text
http://localhost:3001
```

Swagger UI can be used to inspect and test the API at:

```text
http://localhost:3001/docs
```

## Testing the App

Use the following credentials for testing:

Username: `user.dsp@polito.it`

Password: `password`

In the `database` folder you can find a [list](/database/passwords_databases.txt) of the users with their relative passwords.

## Pagination

To set the number of items per page in API pagination, modify the `ELEMENTS_IN_PAGE` variable in `utils/constants.js`.
