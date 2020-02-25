# peru-mapping
Mapping application for Peru

=============

Development
-----------

You can use any editor, although I suggest VS Code.

Ensure you have [Node](https://nodejs.org/en/download/).

    node -v
    v8.11.3

    npm -v
    5.6.0

**Do not use `npm ...` to add or amend local packages!** We use [Yarn](https://yarnpkg.com/lang/en/) to manage packages:

    npm install --global yarn

    yarn -v
    1.7.0

Use [.editorconfig](https://editorconfig.org/) to standardise IDE configuration for all developers working on the project. In VS Code, install the *Editor Config for VS Code* extension.

Use [TsLint](https://palantir.github.io/tslint/). In VS Code, install the *TSLint* extension. In particular, we:

- use 'single quotes' for strings
- do not use semicolons to terminate statements


Set up a .env file for local dev, you can use .env.example

To install/restore packages, run:

    yarn

Then, to launch a local instance of the app, run:

    yarn dev

To build a distribution / deployment into the `dist/` directory:

    yarn build
